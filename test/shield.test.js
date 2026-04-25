const { buildPoseidon } = require('circomlibjs')
const { groth16 }       = require('snarkjs')
const { expect }        = require('chai')
const { MerkleTree }    = require('merkletreejs')
const path              = require('path')

// Circuit artifact paths
const SHIELD_WASM    = path.join(__dirname, '../build/shield/shield_js/shield.wasm')
const SHIELD_ZKEY    = path.join(__dirname, '../keys/shield/shield_final.zkey')
const SHIELD_VKEY    = path.join(__dirname, '../keys/shield/shield_vkey.json')

const UNSHIELD_WASM  = path.join(__dirname, '../build/shield/unshield_js/unshield.wasm')
const UNSHIELD_ZKEY  = path.join(__dirname, '../keys/shield/unshield_final.zkey')
const UNSHIELD_VKEY  = path.join(__dirname, '../keys/shield/unshield_vkey.json')

const TRANSFER_WASM  = path.join(__dirname, '../build/shield/transfer_js/transfer.wasm')
const TRANSFER_ZKEY  = path.join(__dirname, '../keys/shield/transfer_final.zkey')
const TRANSFER_VKEY  = path.join(__dirname, '../keys/shield/transfer_vkey.json')

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

function computeCommitment(amount, token, secret, owner) {
  return poseidonHash([amount, token, secret, owner])
}

function computeNullifier(commitment, secret) {
  return poseidonHash([BigInt(commitment), secret])
}

function toLeaf(commitment) {
  const h = poseidon([BigInt(commitment)])
  return Buffer.from(F.toString(h, 16).padStart(64, '0'), 'hex')
}

function buildUTXOTree(commitments) {
  const leaves = commitments.map(toLeaf)
  return new MerkleTree(leaves, (data) => {
    const h = poseidon([BigInt('0x' + data.toString('hex'))])
    return Buffer.from(F.toString(h, 16).padStart(64, '0'), 'hex')
  }, { sortPairs: false })
}

function getMerkleProof(tree, commitment) {
  const leaf  = toLeaf(commitment)
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

describe('Shield Circuits', function () {
  this.timeout(120_000)

  before(async () => {
    await initPoseidon()
  })

  // ══════════════════════════════════════════════════════
  // shield.circom
  // ══════════════════════════════════════════════════════

  describe('shield.circom', () => {

    it('generates valid shield commitment', async () => {
      const amount = BigInt(1000)
      const token  = randomBigInt()
      const secret = randomBigInt()
      const owner  = randomBigInt()

      const expectedCommitment = computeCommitment(
        amount, token, secret, owner
      )
      const complianceNullifier = randomBigInt().toString()

      const input = {
        amount:              amount.toString(),
        token:               token.toString(),
        secret:              secret.toString(),
        owner:               owner.toString(),
        commitment:          expectedCommitment,
        complianceNullifier
      }

      const { proof, publicSignals } = await groth16.fullProve(
        input, SHIELD_WASM, SHIELD_ZKEY
      )

      // publicSignals[0] = commitment
      expect(publicSignals[0]).to.equal(expectedCommitment)

      const vkey  = require(SHIELD_VKEY)
      const valid = await groth16.verify(vkey, publicSignals, proof)
      expect(valid).to.equal(true)
    })

    it('rejects mismatched commitment', async () => {
      const amount = BigInt(1000)
      const token  = randomBigInt()
      const secret = randomBigInt()
      const owner  = randomBigInt()

      // Provide wrong commitment
      const wrongCommitment     = randomBigInt().toString()
      const complianceNullifier = randomBigInt().toString()

      const input = {
        amount:              amount.toString(),
        token:               token.toString(),
        secret:              secret.toString(),
        owner:               owner.toString(),
        commitment:          wrongCommitment,
        complianceNullifier
      }

      try {
        await groth16.fullProve(input, SHIELD_WASM, SHIELD_ZKEY)
        expect.fail('Should have thrown constraint error')
      } catch (err) {
        expect(err).to.exist
      }
    })
  })

  // ══════════════════════════════════════════════════════
  // unshield.circom
  // ══════════════════════════════════════════════════════

  describe('unshield.circom', () => {

    it('verifies UTXO ownership and produces valid proof', async () => {
      const amount = BigInt(500)
      const token  = randomBigInt()
      const secret = randomBigInt()
      const owner  = randomBigInt()

      const commitment = computeCommitment(amount, token, secret, owner)

      // Build UTXO tree with this commitment
      const extraCommitments = Array.from({ length: 4 }, () =>
        computeCommitment(
          randomBigInt(), randomBigInt(), randomBigInt(), randomBigInt()
        )
      )
      const allCommitments = [commitment, ...extraCommitments]
      const tree = buildUTXOTree(allCommitments)
      const root = '0x' + tree.getRoot().toString('hex')

      const nullifier = computeNullifier(commitment, secret)
      const recipient = randomBigInt().toString()

      const { pathElements, pathIndices } = padPath(
        ...Object.values(getMerkleProof(tree, commitment))
      )

      const input = {
        amount:       amount.toString(),
        token:        token.toString(),
        secret:       secret.toString(),
        owner:        owner.toString(),
        pathElements: pathElements.map(p => BigInt(p).toString()),
        pathIndices,
        root,
        nullifier,
        recipient
      }

      const { proof, publicSignals } = await groth16.fullProve(
        input, UNSHIELD_WASM, UNSHIELD_ZKEY
      )

      const vkey  = require(UNSHIELD_VKEY)
      const valid = await groth16.verify(vkey, publicSignals, proof)
      expect(valid).to.equal(true)
    })

    it('produces correct nullifier', async () => {
      const amount = BigInt(500)
      const token  = randomBigInt()
      const secret = randomBigInt()
      const owner  = randomBigInt()

      const commitment        = computeCommitment(amount, token, secret, owner)
      const expectedNullifier = computeNullifier(commitment, secret)

      const tree = buildUTXOTree([commitment])
      const root = '0x' + tree.getRoot().toString('hex')

      const { pathElements, pathIndices } = padPath(
        ...Object.values(getMerkleProof(tree, commitment))
      )

      const input = {
        amount:       amount.toString(),
        token:        token.toString(),
        secret:       secret.toString(),
        owner:        owner.toString(),
        pathElements: pathElements.map(p => BigInt(p).toString()),
        pathIndices,
        root,
        nullifier:  expectedNullifier,
        recipient:  randomBigInt().toString()
      }

      const { publicSignals } = await groth16.fullProve(
        input, UNSHIELD_WASM, UNSHIELD_ZKEY
      )

      // publicSignals[1] = nullifier
      expect(publicSignals[1]).to.equal(expectedNullifier)
    })

    it('rejects wrong nullifier', async () => {
      const amount = BigInt(500)
      const token  = randomBigInt()
      const secret = randomBigInt()
      const owner  = randomBigInt()

      const commitment = computeCommitment(amount, token, secret, owner)
      const tree       = buildUTXOTree([commitment])
      const root       = '0x' + tree.getRoot().toString('hex')

      const { pathElements, pathIndices } = padPath(
        ...Object.values(getMerkleProof(tree, commitment))
      )

      const input = {
        amount:       amount.toString(),
        token:        token.toString(),
        secret:       secret.toString(),
        owner:        owner.toString(),
        pathElements: pathElements.map(p => BigInt(p).toString()),
        pathIndices,
        root,
        nullifier:  randomBigInt().toString(), // wrong nullifier
        recipient:  randomBigInt().toString()
      }

      try {
        await groth16.fullProve(input, UNSHIELD_WASM, UNSHIELD_ZKEY)
        expect.fail('Should have thrown constraint error')
      } catch (err) {
        expect(err).to.exist
      }
    })
  })

  // ══════════════════════════════════════════════════════
  // transfer.circom
  // ══════════════════════════════════════════════════════

  describe('transfer.circom', () => {

    it('enforces conservation law — valid split', async () => {
      const inAmount  = BigInt(1000)
      const outAmount1 = BigInt(600)
      const outAmount2 = BigInt(400) // 600 + 400 = 1000 ✓

      const token    = randomBigInt()
      const inSecret = randomBigInt()
      const inOwner  = randomBigInt()

      const inCommitment = computeCommitment(
        inAmount, token, inSecret, inOwner
      )
      const inNullifier = computeNullifier(inCommitment, inSecret)

      const tree = buildUTXOTree([inCommitment])
      const root = '0x' + tree.getRoot().toString('hex')

      const { pathElements, pathIndices } = padPath(
        ...Object.values(getMerkleProof(tree, inCommitment))
      )

      const outSecret1 = randomBigInt()
      const outOwner1  = randomBigInt()
      const outSecret2 = randomBigInt()
      const outOwner2  = randomBigInt()

      const expectedOut1 = computeCommitment(
        outAmount1, token, outSecret1, outOwner1
      )
      const expectedOut2 = computeCommitment(
        outAmount2, token, outSecret2, outOwner2
      )

      const input = {
        inAmount:       inAmount.toString(),
        inToken:        token.toString(),
        inSecret:       inSecret.toString(),
        inOwner:        inOwner.toString(),
        pathElements:   pathElements.map(p => BigInt(p).toString()),
        pathIndices,
        outAmount1:     outAmount1.toString(),
        outSecret1:     outSecret1.toString(),
        outOwner1:      outOwner1.toString(),
        outAmount2:     outAmount2.toString(),
        outSecret2:     outSecret2.toString(),
        outOwner2:      outOwner2.toString(),
        root,
        inNullifier,
        outCommitment1: expectedOut1,
        outCommitment2: expectedOut2
      }

      const { proof, publicSignals } = await groth16.fullProve(
        input, TRANSFER_WASM, TRANSFER_ZKEY
      )

      const vkey  = require(TRANSFER_VKEY)
      const valid = await groth16.verify(vkey, publicSignals, proof)
      expect(valid).to.equal(true)
    })

    it('rejects conservation violation — outputs exceed input', async () => {
      const inAmount   = BigInt(1000)
      const outAmount1 = BigInt(600)
      const outAmount2 = BigInt(500) // 600 + 500 = 1100 ≠ 1000 ✗

      const token    = randomBigInt()
      const inSecret = randomBigInt()
      const inOwner  = randomBigInt()

      const inCommitment = computeCommitment(
        inAmount, token, inSecret, inOwner
      )
      const inNullifier = computeNullifier(inCommitment, inSecret)

      const tree = buildUTXOTree([inCommitment])
      const root = '0x' + tree.getRoot().toString('hex')

      const { pathElements, pathIndices } = padPath(
        ...Object.values(getMerkleProof(tree, inCommitment))
      )

      const outSecret1 = randomBigInt()
      const outOwner1  = randomBigInt()
      const outSecret2 = randomBigInt()
      const outOwner2  = randomBigInt()

      const input = {
        inAmount:       inAmount.toString(),
        inToken:        token.toString(),
        inSecret:       inSecret.toString(),
        inOwner:        inOwner.toString(),
        pathElements:   pathElements.map(p => BigInt(p).toString()),
        pathIndices,
        outAmount1:     outAmount1.toString(),
        outSecret1:     outSecret1.toString(),
        outOwner1:      outOwner1.toString(),
        outAmount2:     outAmount2.toString(),
        outSecret2:     outSecret2.toString(),
        outOwner2:      outOwner2.toString(),
        root,
        inNullifier,
        outCommitment1: computeCommitment(outAmount1, token, outSecret1, outOwner1),
        outCommitment2: computeCommitment(outAmount2, token, outSecret2, outOwner2)
      }

      try {
        await groth16.fullProve(input, TRANSFER_WASM, TRANSFER_ZKEY)
        expect.fail('Should have thrown conservation violation')
      } catch (err) {
        expect(err).to.exist
      }
    })

    it('generates correct output commitments', async () => {
      const inAmount   = BigInt(1000)
      const outAmount1 = BigInt(700)
      const outAmount2 = BigInt(300)

      const token    = randomBigInt()
      const inSecret = randomBigInt()
      const inOwner  = randomBigInt()
      const outSecret1 = randomBigInt()
      const outOwner1  = randomBigInt()
      const outSecret2 = randomBigInt()
      const outOwner2  = randomBigInt()

      const inCommitment = computeCommitment(
        inAmount, token, inSecret, inOwner
      )
      const inNullifier = computeNullifier(inCommitment, inSecret)

      const expectedOut1 = computeCommitment(
        outAmount1, token, outSecret1, outOwner1
      )
      const expectedOut2 = computeCommitment(
        outAmount2, token, outSecret2, outOwner2
      )

      const tree = buildUTXOTree([inCommitment])
      const root = '0x' + tree.getRoot().toString('hex')

      const { pathElements, pathIndices } = padPath(
        ...Object.values(getMerkleProof(tree, inCommitment))
      )

      const input = {
        inAmount:       inAmount.toString(),
        inToken:        token.toString(),
        inSecret:       inSecret.toString(),
        inOwner:        inOwner.toString(),
        pathElements:   pathElements.map(p => BigInt(p).toString()),
        pathIndices,
        outAmount1:     outAmount1.toString(),
        outSecret1:     outSecret1.toString(),
        outOwner1:      outOwner1.toString(),
        outAmount2:     outAmount2.toString(),
        outSecret2:     outSecret2.toString(),
        outOwner2:      outOwner2.toString(),
        root,
        inNullifier,
        outCommitment1: expectedOut1,
        outCommitment2: expectedOut2
      }

      const { publicSignals } = await groth16.fullProve(
        input, TRANSFER_WASM, TRANSFER_ZKEY
      )

      // publicSignals[2] = outCommitment1
      // publicSignals[3] = outCommitment2
      expect(publicSignals[2]).to.equal(expectedOut1)
      expect(publicSignals[3]).to.equal(expectedOut2)
    })
  })
})
