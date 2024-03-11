import hre from 'hardhat'

async function main (): Promise<void> {
  await hre.viem.deployContract('PreferedNetworkRegistry', [])
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
