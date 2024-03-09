import {
  Chain,
  WatchContractEventReturnType,
  createPublicClient,
  createWalletClient,
  http,
  getContract,
} from "viem";
import { normalize } from "viem/ens";
import { mainnet } from "viem/chains";
import abi from "./constants/abi";
import address from "./constants/address";

/**
 * Library for interacting with user's stated prefered networks stated in
 * the smart contract `PreferedNetworkRegistry.sol`
 * @param configuration
 */
export default function preferredNetworkRegistry(configuration: {
  public: Parameters<typeof createPublicClient>;
  wallet: Parameters<typeof createWalletClient>;
  callbacks: {
    onPreferredNetworkSet?: (network: bigint) => void;
    onPaymentApproved?: (hash: bigint) => void;
    onNetworkChanged?: (network: Chain) => void;
    onContractEvents?: (logs: any) => void; // TODO: define logs type
  };
}) {
  const publicClient = createPublicClient({
    ...configuration.public,
    chain: mainnet,
    transport: http(),
  });

  const wallet = createWalletClient({
    ...configuration.wallet,
    chain: mainnet,
    transport: http(),
  });

  const contract = getContract({
    address,
    abi,
    client: { public: publicClient, wallet },
  });

  /**
   * Current main address of the user
   * @returns
   */
  const getCurrentAddress = async () => {
    return (await wallet.getAddresses())[0];
  };

  /**
   * Resolves the prefered network for `address`
   * @param address
   * @returns
   */
  const getPreferredNetwork = async (address: `0x${string}`) => {
    return await contract.read.getPreferredNetwork([address]);
  };

  /**
   * Resolves the prefered network for `ens`
   * @param ens
   * @returns
   */
  const getPreferedNetworkFromENS = async (ens: string) => {
    const ensAddress = await publicClient.getEnsAddress({
      name: normalize("wevm.eth"),
    });
    return await getPreferredNetwork(ensAddress as `0x${string}`);
  };

  /**
   * Resolves the current network for currently logged in user
   * @returns
   */
  const resolveCurrentPreferredNetwork = async () => {
    return await contract.read.getPreferredNetwork([await getCurrentAddress()]);
  };

  /**
   * Switches to the prefered network for the currently logged in user
   */
  const switchToPreferredNetwork = async () => {
    const account = await getCurrentAddress();
    const network = await contract.read.getPreferredNetwork([account]);
    await wallet.switchChain({ id: Number(network) });
  };

  /**
   * Sets the prefered network for the currently logged in user in the smart contract
   * @param network
   * @returns
   */
  const setPreferredNetwork = async (network: bigint) => {
    const account = await getCurrentAddress();
    return await contract.write.setPreferredNetwork([network], {
      account,
      onApproved: configuration.callbacks.onPreferredNetworkSet,
    });
  };

  /**
   * Sends ETH to another account
   * @param to
   * @param value
   * @returns transaction receipt when complete
   */
  const payAddress = async (to: `0x${string}`, value: bigint) => {
    const account = await getCurrentAddress();
    const hash = await wallet.sendTransaction({
      account,
      to,
      value,
    });

    return await publicClient.waitForTransactionReceipt({
      hash,
    });
  };

  /**
   * Pay user by their ENS address
   * @param name
   * @param value
   * @returns
   */
  const payENSAddress = async (name: string, value: bigint) => {
    const address = await publicClient.getEnsAddress({ name });
    return await payAddress(address as `0x${string}`, value);
  };

  /**
   * Pay a user on their stated prefered network
   * @param address
   * @param value
   * @returns
   */
  const payOnPreferedNetwork = async (
    address: `0x${string}`,
    value: bigint
  ) => {
    const recipientPreferredNetwork = await getPreferredNetwork(address);
    await wallet.switchChain({ id: Number(recipientPreferredNetwork) });
    return await payAddress(address, value);
  };

  /**
   * Pays an ENS account on it's stated prefered network
   * @param name
   * @param value
   * @returns
   */
  const payENSOnPreferedNetwork = async (name: string, value: bigint) => {
    const address = await publicClient.getEnsAddress({ name });
    return await payOnPreferedNetwork(address as `0x${string}`, value);
  };

  const watchers: WatchContractEventReturnType[] = [];

  /**
   * Starts listening to events from contract for subscribers
   */
  const startContractEventListeners = async () => {
    if (configuration.callbacks.onContractEvents) {
      const unwatch = publicClient.watchContractEvent({
        address,
        abi,
        onLogs: configuration.callbacks.onContractEvents,
      });
      watchers.push(unwatch);
    }
  };

  /**
   * Removes any active event listeners to contract
   */
  const removeContractEventListeners = () => {
    watchers.forEach((unwatch) => unwatch());
    watchers.length = 0;
  };

  startContractEventListeners();

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
    removeContractEventListeners,
  };
}
