import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

const UniswapV2CoreModule = buildModule('UniswapV2CoreModule', (m) => {
  const owner = m.getAccount(0)
  const factory = m.contract('UniswapV2Factory', [owner])
  const pair = m.contract('UniswapV2Pair', [])

  return { factory, pair }
})

export default UniswapV2CoreModule
