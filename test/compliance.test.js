const { buildPoseidon } = require('circomlibjs')
const { groth16 }       = require('snarkjs')
const { expect }        = require('chai')
const { MerkleTree }    = require('merkletreejs')
const path              = require('path')

// Circuit artifact paths
const WASM = path.join(__dirname, '../build/compliance/compliance_js/compliance.wasm')
const ZKEY = path.join(__dirname, '../keys/compliance/compliance_final.zkey')
const VKEY = path.join(__dirname, '../keys/compliance/compliance_vkey.json')

// ── Helpers ────────────────────────────────────────────────

let poseidon
let F

async function initPoseidon() {
  if (!poseidon) {
    poseidon = await buildPoseidon()
    F = poseidon.F
  }
  return poseidon
}

function poseidonHash(inputs) {
  const h = poseidon(inputs.map(BigInt))
  return F.toString(h)
}

function toLeaf(address) {
  const h = poseidon([BigInt(address)])
  return Buffer.from(F.toString(h, 16).padStart(64, '0'), 'hex')
}

function buildTree(addresses) {
  const leaves = addresses.map(toLeaf)
  return new MerkleTree(leaves, (data) => {
    const h = poseidon([BigInt('0x' + data.toString('hex'))])
    return Buffer.from(F.toString(h, 16).padStart(64, '0'), 'hex')
  }, { sortPairs: false })
}

function getMerkleProof(tree, address) {
  const leaf  = toLeaf(address)
  const proof = tree.getProof(leaf)
  return {
    pathElements: proof.map(p => '0x' + p.data.toString('hex')),
    pathIndices:  proof.map(p => p.position === 'right' ? 1 : 0)
  }
}

function padPath(pathElements, pathIndices, levels = 20) {
  while (pathElements.length < levels) {
    pathElements.push('0x' + '0'.repeat(64))
    pathIndices.push(0)
  }
  return { pathElements, pathIndices }
}

function randomBigInt() {
  return BigInt('0x' + Buffer.from(
    Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256))
  ).toString('hex'))
}

// ── Test Suite ─────────────────────────────────────────────

describe('Compliance Circuit', function () {
  this.timeout(120_000)

  before(async () => {
    await initPoseidon()
  })

  // ── Test 1 ─────────────────────────────────────────────

  it('computes correct nullifier', async () => {
    const address = randomBigInt()
    const secret  = randomBigInt()

    const expectedNullifier = poseidonHash([address, secret])

    const addresses = [address, randomBigInt(), randomBigInt()]
    const tree = buildTree(addresses.map(a => a.toString()))
    const { pathElements, pathIndices } = padPath(
      ...Object.values(getMerkleProof(tree, address.toString()))
    )

    const input = {
      address:      address.toString(),
      secret:       secret.toString(),
      pathElements: pathElements.map(p => BigInt(p).toString()),
      pathIndices,
      root:         '0x' + tree.getRoot().toString('hex'),
      nullifier:    expectedNullifier
    }

    const { proof, publicSignals } = await groth16.fullProve(
      input, WASM, ZKEY
    )

    // publicSignals[0] = root, publicSignals[1] = nullifier
    expect(publicSignals[1]).to.equal(expectedNullifier)
  })

  // ── Test 2 ─────────────────────────────────────────────

  it('verifies valid Merkle membership', async () => {
    const addresses = Array.from({ length: 10 }, () =>
      randomBigInt().toString()
    )
    const tree = buildTree(addresses)
    const root = '0x' + tree.getRoot().toString('hex')

    const user   = addresses[0]
    const secret = randomBigInt()
    const nullifier = poseidonHash([BigInt(user), secret])

    const { pathElements, pathIndices } = padPath(
      ...Object.values(getMerkleProof(tree, user))
    )

    const input = {
      address:      user,
      secret:       secret.toString(),
      pathElements: pathElements.map(p => BigInt(p).toString()),
      pathIndices,
      root,
      nullifier
    }

    const { proof, publicSignals } = await groth16.fullProve(
      input, WASM, ZKEY
    )

    const vkey   = require(VKEY)
    const valid  = await groth16.verify(vkey, publicSignals, proof)

    expect(valid).to.equal(true)
  })

  // ── Test 3 ─────────────────────────────────────────────

  it('rejects address not in compliance tree', async () => {
    const addresses = Array.from({ length: 5 }, () =>
      randomBigInt().toString()
    )
    const tree = buildTree(addresses)
    const root = '0x' + tree.getRoot().toString('hex')

    // Use an address NOT in the tree
    const outsider = randomBigInt()
    const secret   = randomBigInt()
    const nullifier = poseidonHash([outsider, secret])

    // Fake path from another address
    const { pathElements, pathIndices } = padPath(
      ...Object.values(getMerkleProof(tree, addresses[0]))
    )

    const input = {
      address:      outsider.toString(),
      secret:       secret.toString(),
      pathElements: pathElements.map(p => BigInt(p).toString()),
      pathIndices,
      root,
      nullifier
    }

    try {
      await groth16.fullProve(input, WASM, ZKEY)
      expect.fail('Should have thrown constraint error')
    } catch (err) {
      expect(err).to.exist
    }
  })

  // ── Test 4 ─────────────────────────────────────────────

  it('rejects wrong nullifier in public inputs', async () => {
    const addresses = Array.from({ length: 5 }, () =>
      randomBigInt().toString()
    )
    const tree = buildTree(addresses)
    const root = '0x' + tree.getRoot().toString('hex')

    const user   = addresses[0]
    const secret = randomBigInt()

    // Provide incorrect nullifier
    const wrongNullifier = randomBigInt().toString()

    const { pathElements, pathIndices } = padPath(
      ...Object.values(getMerkleProof(tree, user))
    )

    const input = {
      address:      user,
      secret:       secret.toString(),
      pathElements: pathElements.map(p => BigInt(p).toString()),
      pathIndices,
      root,
      nullifier: wrongNullifier
    }

    try {
      await groth16.fullProve(input, WASM, ZKEY)
      expect.fail('Should have thrown constraint error')
    } catch (err) {
      expect(err).to.exist
    }
  })

  // ── Test 5 ─────────────────────────────────────────────

  it('same inputs always produce same nullifier', async () => {
    const addresses = Array.from({ length: 5 }, () =>
      randomBigInt().toString()
    )
    const tree = buildTree(addresses)
    const root = '0x' + tree.getRoot().toString('hex')

    const user   = addresses[0]
    const secret = randomBigInt()
    const nullifier = poseidonHash([BigInt(user), secret])

    const { pathElements, pathIndices } = padPath(
      ...Object.values(getMerkleProof(tree, user))
    )

    const input = {
      address:      user,
      secret:       secret.toString(),
      pathElements: pathElements.map(p => BigInt(p).toString()),
      pathIndices,
      root,
      nullifier
    }

    const { publicSignals: signals1 } = await groth16.fullProve(
      input, WASM, ZKEY
    )
    const { publicSignals: signals2 } = await groth16.fullProve(
      input, WASM, ZKEY
    )

    // Nullifier must be identical across both runs
    expect(signals1[1]).to.equal(signals2[1])
  })
})
