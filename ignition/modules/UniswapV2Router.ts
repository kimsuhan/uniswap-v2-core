import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

const UniswapV2RouterModule = buildModule('UniswapV2RouterModule', (m) => {
  const owner = m.getAccount(0)
  const factory = m.contract('UniswapV2Factory', [owner])
  const pair = m.contract('UniswapV2Pair', [])
  const weth = m.contract('WETH', [])

  const router = m.contract('UniswapV2Router', [factory, weth])

  return { factory, pair, weth, router }
})

export default UniswapV2RouterModule
