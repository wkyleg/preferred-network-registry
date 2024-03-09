// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PreferedNetworkRegistry {
    // Mapping from user's address to their preferred network (as an integer)
    mapping(address => uint) public networkPreferences;

    // Event to be emitted when a user sets or changes their preferred network
    event NetworkPreferenceSet(address indexed user, uint network);

    /**
     * @dev Set or change the preferred network for the msg.sender
     * @param _network The preferred network, represented as an integer
     */
    function setPreferredNetwork(uint _network) public {
        require(_network > 0, "Invalid network ID"); // Validate input
        networkPreferences[msg.sender] = _network;
        emit NetworkPreferenceSet(msg.sender, _network);
    }

    /**
     * @dev Get the preferred network of a user
     * @param _user Address of the user
     * @return network The preferred network of the user
     */
    function getPreferredNetwork(address _user) public view returns (uint) {
        return networkPreferences[_user];
    }
}
