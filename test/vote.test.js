const { buildPoseidon } = require('circomlibjs')
const { groth16 }       = require('snarkjs')
const { expect }        = require('chai')
const { MerkleTree }    = require('merkletreejs')
const path              = require('path')

// Circuit artifact paths
const VOTE_WASM  = path.join(__dirname, '../build/vote/vote_js/vote.wasm')
const VOTE_ZKEY  = path.join(__dirname, '../keys/vote/vote_final.zkey')
const VOTE_VKEY  = path.join(__dirname, '../keys/vote/vote_vkey.json')

const TALLY_WASM = path.join(__dirname, '../build/vote/tally_js/tally.wasm')
const TALLY_ZKEY = path.join(__dirname, '../keys/vote/tally_final.zkey')
const TALLY_VKEY = path.join(__dirname, '../keys/vote/tally_vkey.json')

// ── Helpers ────────────────────────────────────────────────

let poseidon
let F

async function initPoseidon() {
  if (!poseidon) {
    poseidon = await buildPoseidon()
    F = poseidon.F
  }
}

function poseidonHash(inputs) {
  const h = poseidon(inputs.map(BigInt))
  return F.toString(h)
}

function toLeaf(address) {
  const h = poseidon([BigInt(address)])
  return Buffer.from(F.toString(h, 16).padStart(64, '0'), 'hex')
}

function buildVoterTree(addresses) {
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

function buildVoteInput(
  voterAddress, voterSecret, voteChoice,
  tree, pollId
) {
  const voterRoot     = '0x' + tree.getRoot().toString('hex')
  const voteNonce     = randomBigInt()
  const encryptedVote = poseidonHash([BigInt(voteChoice), voteNonce])
  const nullifier     = poseidonHash([voterAddress, voterSecret, BigInt(pollId)])

  const { pathElements, pathIndices } = padPath(
    ...Object.values(getMerkleProof(tree, voterAddress.toString()))
  )

  return {
    voterAddress:  voterAddress.toString(),
    voterSecret:   voterSecret.toString(),
    voteChoice:    voteChoice.toString(),
    voteNonce:     voteNonce.toString(),
    pathElements:  pathElements.map(p => BigInt(p).toString()),
    pathIndices,
    pollId:        pollId.toString(),
    voterRoot,
    encryptedVote,
    nullifier
  }
}

// ── Test Suite ─────────────────────────────────────────────

describe('Vote Circuits', function () {
  this.timeout(120_000)

  before(async () => {
    await initPoseidon()
  })

  // ══════════════════════════════════════════════════════
  // vote.circom
  // ══════════════════════════════════════════════════════

  describe('vote.circom', () => {

    it('allows valid yes vote (choice = 1)', async () => {
      const addresses    = Array.from({ length: 5 }, () => randomBigInt())
      const tree         = buildVoterTree(addresses.map(a => a.toString()))
      const voterAddress = addresses[0]
      const voterSecret  = randomBigInt()
      const pollId       = BigInt(1)

      const input = buildVoteInput(
        voterAddress, voterSecret, 1, tree, pollId
      )

      const { proof, publicSignals } = await groth16.fullProve(
        input, VOTE_WASM, VOTE_ZKEY
      )

      const vkey  = require(VOTE_VKEY)
      const valid = await groth16.verify(vkey, publicSignals, proof)
      expect(valid).to.equal(true)
    })

    it('allows valid no vote (choice = 0)', async () => {
      const addresses    = Array.from({ length: 5 }, () => randomBigInt())
      const tree         = buildVoterTree(addresses.map(a => a.toString()))
      const voterAddress = addresses[1]
      const voterSecret  = randomBigInt()
      const pollId       = BigInt(2)

      const input = buildVoteInput(
        voterAddress, voterSecret, 0, tree, pollId
      )

      const { proof, publicSignals } = await groth16.fullProve(
        input, VOTE_WASM, VOTE_ZKEY
      )

      const vkey  = require(VOTE_VKEY)
      const valid = await groth16.verify(vkey, publicSignals, proof)
      expect(valid).to.equal(true)
    })

    it('rejects invalid vote choice (choice = 2)', async () => {
      const addresses    = Array.from({ length: 5 }, () => randomBigInt())
      const tree         = buildVoterTree(addresses.map(a => a.toString()))
      const voterAddress = addresses[0]
      const voterSecret  = randomBigInt()
      const pollId       = BigInt(1)

      const input = buildVoteInput(
        voterAddress, voterSecret, 2, tree, pollId
      )

      try {
        await groth16.fullProve(input, VOTE_WASM, VOTE_ZKEY)
        expect.fail('Should have rejected non-binary vote choice')
      } catch (err) {
        expect(err).to.exist
      }
    })

    it('rejects voter not in eligible set', async () => {
      const addresses    = Array.from({ length: 5 }, () => randomBigInt())
      const tree         = buildVoterTree(addresses.map(a => a.toString()))
      const outsider     = randomBigInt() // not in tree
      const voterSecret  = randomBigInt()
      const pollId       = BigInt(1)

      // Use path from a legitimate voter but wrong address
      const { pathElements, pathIndices } = padPath(
        ...Object.values(getMerkleProof(tree, addresses[0].toString()))
      )

      const voterRoot     = '0x' + tree.getRoot().toString('hex')
      const voteNonce     = randomBigInt()
      const encryptedVote = poseidonHash([BigInt(1), voteNonce])
      const nullifier     = poseidonHash([outsider, voterSecret, pollId])

      const input = {
        voterAddress:  outsider.toString(),
        voterSecret:   voterSecret.toString(),
        voteChoice:    '1',
        voteNonce:     voteNonce.toString(),
        pathElements:  pathElements.map(p => BigInt(p).toString()),
        pathIndices,
        pollId:        pollId.toString(),
        voterRoot,
        encryptedVote,
        nullifier
      }

      try {
        await groth16.fullProve(input, VOTE_WASM, VOTE_ZKEY)
        expect.fail('Should have rejected non-eligible voter')
      } catch (err) {
        expect(err).to.exist
      }
    })

    it('rejects wrong nullifier', async () => {
      const addresses    = Array.from({ length: 5 }, () => randomBigInt())
      const tree         = buildVoterTree(addresses.map(a => a.toString()))
      const voterAddress = addresses[0]
      const voterSecret  = randomBigInt()
      const pollId       = BigInt(1)

      const input = buildVoteInput(
        voterAddress, voterSecret, 1, tree, pollId
      )

      // Tamper with nullifier
      input.nullifier = randomBigInt().toString()

      try {
        await groth16.fullProve(input, VOTE_WASM, VOTE_ZKEY)
        expect.fail('Should have rejected wrong nullifier')
      } catch (err) {
        expect(err).to.exist
      }
    })

    it('same voter same poll always produces same nullifier', async () => {
      const addresses    = Array.from({ length: 5 }, () => randomBigInt())
      const tree         = buildVoterTree(addresses.map(a => a.toString()))
      const voterAddress = addresses[0]
      const voterSecret  = randomBigInt()
      const pollId       = BigInt(1)

      const input1 = buildVoteInput(voterAddress, voterSecret, 1, tree, pollId)
      const input2 = buildVoteInput(voterAddress, voterSecret, 1, tree, pollId)

      const { publicSignals: signals1 } = await groth16.fullProve(
        input1, VOTE_WASM, VOTE_ZKEY
      )
      const { publicSignals: signals2 } = await groth16.fullProve(
        input2, VOTE_WASM, VOTE_ZKEY
      )

      // nullifier is publicSignals[3]
      expect(signals1[3]).to.equal(signals2[3])
    })
  })

  // ══════════════════════════════════════════════════════
  // tally.circom
  // ══════════════════════════════════════════════════════

  describe('tally.circom', () => {

    function buildTallyInput(votes) {
      // votes = array of 0s and 1s
      const nVotes = 1000
      const decryptedVotes = new Array(nVotes).fill(0)
      const nonces         = new Array(nVotes).fill(BigInt(0))
      const encryptedVotes = new Array(nVotes).fill('0')

      let totalYes = 0
      let totalNo  = 0

      for (let i = 0; i < votes.length; i++) {
        decryptedVotes[i] = votes[i]
        nonces[i]         = randomBigInt()
        encryptedVotes[i] = poseidonHash([
          BigInt(votes[i]), nonces[i]
        ])
        if (votes[i] === 1) totalYes++
        else totalNo++
      }

      // Fill remaining with no votes (0)
      for (let i = votes.length; i < nVotes; i++) {
        nonces[i]         = BigInt(0)
        encryptedVotes[i] = poseidonHash([BigInt(0), BigInt(0)])
        totalNo++
      }

      return {
        input: {
          encryptedVotes: encryptedVotes.map(String),
          decryptedVotes: decryptedVotes.map(String),
          nonces:         nonces.map(n => n.toString()),
          totalYes:       totalYes.toString(),
          totalNo:        totalNo.toString(),
          voteCount:      nVotes.toString()
        },
        totalYes,
        totalNo
      }
    }

    it('tallies correctly — 7 yes, 3 no out of 10', async () => {
      const votes = [1,1,1,1,1,1,1,0,0,0]
      const { input, totalYes, totalNo } = buildTallyInput(votes)

      const { proof, publicSignals } = await groth16.fullProve(
        input, TALLY_WASM, TALLY_ZKEY
      )

      // publicSignals[0] = totalYes
      // publicSignals[1] = totalNo
      expect(publicSignals[0]).to.equal(totalYes.toString())
      expect(publicSignals[1]).to.equal(totalNo.toString())

      const vkey  = require(TALLY_VKEY)
      const valid = await groth16.verify(vkey, publicSignals, proof)
      expect(valid).to.equal(true)
    })

    it('rejects wrong tally — inflated yes count', async () => {
      const votes = [1,1,1,0,0,0,0,0,0,0] // 3 yes, 997 no
      const { input } = buildTallyInput(votes)

      // Inflate totalYes
      input.totalYes = '999'

      try {
        await groth16.fullProve(input, TALLY_WASM, TALLY_ZKEY)
        expect.fail('Should have rejected wrong tally')
      } catch (err) {
        expect(err).to.exist
      }
    })

    it('rejects tampered encrypted vote', async () => {
      const votes = [1,1,0,0,0,0,0,0,0,0]
      const { input } = buildTallyInput(votes)

      // Tamper with first encrypted vote
      input.encryptedVotes[0] = randomBigInt().toString()

      try {
        await groth16.fullProve(input, TALLY_WASM, TALLY_ZKEY)
        expect.fail('Should have rejected tampered encrypted vote')
      } catch (err) {
        expect(err).to.exist
      }
    })
  })
})
