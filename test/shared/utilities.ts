import { ethers, getAddress, keccak256, solidityPacked, toUtf8Bytes } from 'ethers'
import { ERC20 } from '../../typechain-types'

const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder()

const PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

export async function getApprovalDigest(
  token: ERC20,
  approve: {
    owner: string
    spender: string
    value: BigInt
  },
  nonce: BigInt,
  deadline: BigInt
) {
  const name = await token.name()
  // const DOMAIN_SEPARATOR = getDomainSeparator(name, await token.getAddress())
  const DOMAIN_SEPARATOR = await token.DOMAIN_SEPARATOR()
  return keccak256(
    solidityPacked(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        keccak256(
          defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
          )
        ),
      ]
    )
  )
}

export function getCreate2Address(
  factoryAddress: string,
  [tokenA, tokenB]: [string, string],
  bytecode: string
): string {
  const [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA]
  const create2Inputs = [
    '0xff',
    factoryAddress,
    keccak256(solidityPacked(['address', 'address'], [token0, token1])),
    keccak256(bytecode),
  ]
  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join('')}`
  return getAddress(`0x${keccak256(sanitizedInputs).slice(-40)}`)
}
