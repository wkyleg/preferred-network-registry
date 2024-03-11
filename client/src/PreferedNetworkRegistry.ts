import {
  type Chain,
  type WatchContractEventReturnType,
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  type TransactionReceipt
} from 'viem'
import { normalize } from 'viem/ens'
import { mainnet } from 'viem/chains'
import abi from './constants/abi'
import address from './constants/address'
import { type WatchContractEventOnLogsFn } from 'viem/_types/actions/public/watchContractEvent'

export interface PreferedNetworkRegistryClient {
  contract: ReturnType<typeof getContract>
  getPreferredNetwork: (address: `0x${string}`) => Promise<bigint>
  getPreferedNetworkFromENS: (ens: string) => Promise<bigint | null>
  resolveCurrentPreferredNetwork: () => Promise<bigint>
  setPreferredNetwork: (network: bigint) => Promise<`0x${string}`>
  switchToPreferredNetwork: () => Promise<void>
  payAddress: (to: `0x${string}`, value: bigint) => Promise<TransactionReceipt>
  payENSAddress: (name: string, value: bigint) => Promise<TransactionReceipt>
  payOnPreferedNetwork: (
    address: `0x${string}`,
    value: bigint
  ) => Promise<TransactionReceipt>
  payENSOnPreferedNetwork: (
    name: string,
    value: bigint
  ) => Promise<TransactionReceipt>
  removeContractEventListeners: () => void
}

/**
 * Library for interacting with user's stated prefered networks stated in
 * the smart contract `PreferedNetworkRegistry.sol`
 * @param configuration
 */
export default function preferredNetworkRegistry (configuration: {
  public: Parameters<typeof createPublicClient>
  wallet: Parameters<typeof createWalletClient>
  callbacks?: {
    onPreferredNetworkSet?: (network: bigint) => void
    onPaymentApproved?: (hash: bigint) => void
    onNetworkChanged?: (network: Chain) => void
    onContractEvents?: WatchContractEventOnLogsFn
  }
}): PreferedNetworkRegistryClient {
  const publicClient = createPublicClient({
    ...configuration.public,
    chain: mainnet,
    transport: http()
  })

  const wallet = createWalletClient({
    ...configuration.wallet,
    chain: mainnet,
    transport: http()
  })

  const contract = getContract({
    address,
    abi,
    client: { public: publicClient, wallet }
  })

  /**
   * Current main address of the user
   */
  const getCurrentAddress = async (): Promise<`0x${string}`> => {
    return (await wallet.getAddresses())[0]
  }

  /**
   * Resolves the prefered network for `address`
   * @param address
   */
  const getPreferredNetwork = async (
    address: `0x${string}`
  ): Promise<bigint> => {
    return await contract.read.getPreferredNetwork([address])
  }

  /**
   * Resolves the prefered network for `ens`
   * @param ens
   * @returns
   */
  const getPreferedNetworkFromENS = async (
    ens: string
  ): Promise<bigint | null> => {
    const ensAddress = await publicClient.getEnsAddress({
      name: normalize('wevm.eth')
    })
    if (ensAddress === null) {
      return null
    }
    return await getPreferredNetwork(ensAddress)
  }

  /**
   * Resolves the current network for currently logged in user
   * @returns
   */
  const resolveCurrentPreferredNetwork = async (): Promise<bigint> => {
    return await contract.read.getPreferredNetwork([await getCurrentAddress()])
  }

  /**
   * Switches to the prefered network for the currently logged in user
   */
  const switchToPreferredNetwork = async (): Promise<void> => {
    const account = await getCurrentAddress()
    const network = await contract.read.getPreferredNetwork([account])
    await wallet.switchChain({ id: Number(network) })
  }

  /**
   * Sets the prefered network for the currently logged in user in the smart contract
   * @param network
   * @returns
   */
  const setPreferredNetwork = async (
    network: bigint
  ): Promise<`0x${string}`> => {
    const account = await getCurrentAddress()
    return await contract.write.setPreferredNetwork([network], {
      account,
      onApproved: configuration?.callbacks?.onPreferredNetworkSet
    })
  }

  /**
   * Sends ETH to another account
   * @param to
   * @param value
   * @returns transaction receipt when complete
   */
  const payAddress = async (
    to: `0x${string}`,
    value: bigint
  ): Promise<TransactionReceipt> => {
    const account = await getCurrentAddress()
    const hash = await wallet.sendTransaction({
      account,
      to,
      value
    })

    return await publicClient.waitForTransactionReceipt({
      hash
    })
  }

  /**
   * Pay user by their ENS address
   * @param name
   * @param value
   * @returns
   */
  const payENSAddress = async (
    name: string,
    value: bigint
  ): Promise<TransactionReceipt> => {
    const address = await publicClient.getEnsAddress({ name })

    if (address === null) {
      throw new Error(`Could not resolve address for ENS name: ${name}`)
    }

    return await payAddress(address, value)
  }

  /**
   * Pay a user on their stated prefered network
   * @param address
   * @param value
   * @returns
   */
  const payOnPreferedNetwork = async (
    address: `0x${string}`,
    value: bigint
  ): ReturnType<typeof payAddress> => {
    const recipientPreferredNetwork = await getPreferredNetwork(address)
    await wallet.switchChain({ id: Number(recipientPreferredNetwork) })
    return await payAddress(address, value)
  }

  /**
   * Pays an ENS account on it's stated prefered network
   * @param name
   * @param value
   * @returns
   */
  const payENSOnPreferedNetwork = async (
    name: string,
    value: bigint
  ): Promise<TransactionReceipt> => {
    const address = await publicClient.getEnsAddress({ name })

    if (address === null) {
      throw new Error(`Could not resolve address for ENS name: ${name}`)
    }

    return await payOnPreferedNetwork(address, value)
  }

  const watchers: WatchContractEventReturnType[] = []

  /**
   * Starts listening to events from contract for subscribers
   */
  const startContractEventListeners = (): void => {
    if (configuration?.callbacks?.onContractEvents !== null) {
      const unwatch = publicClient.watchContractEvent({
        address,
        abi,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-non-null-asserted-optional-chain
        onLogs: configuration?.callbacks?.onContractEvents
      })
      watchers.push(unwatch)
    }
  }

  /**
   * Removes any active event listeners to contract
   */
  const removeContractEventListeners = (): void => {
    watchers.forEach(unwatch => {
      unwatch()
    })
    watchers.length = 0
  }

  startContractEventListeners()

  return {
    contract,
    getPreferredNetwork,
    getPreferedNetworkFromENS,
    resolveCurrentPreferredNetwork,
    setPreferredNetwork,
    switchToPreferredNetwork,
    payAddress,
    payENSAddress,
    payOnPreferedNetwork,
    payENSOnPreferedNetwork,
    removeContractEventListeners
  }
}
