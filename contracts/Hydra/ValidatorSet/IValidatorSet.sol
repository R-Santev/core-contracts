// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./../common/Vesting/Vesting.sol";

struct ValidatorInit {
    address addr;
    uint256[4] pubkey;
    uint256[2] signature;
    uint256 stake;
}

/**
 * @notice struct representation of a pool for reward distribution
 * @dev pools are formed by delegators to a specific validator
 * @dev uses virtual balances to track slashed delegations
 * @param supply amount of tokens in the pool
 * @param virtualSupply the total supply of virtual balances in the pool
 * @param magnifiedRewardPerShare coefficient to aggregate rewards
 * @param validator the address of the validator the pool based on
 * @param magnifiedRewardCorrections adjustments to reward magnifications by address
 * @param claimedRewards amount claimed by address
 * @param balances virtual balance by address
 */
struct RewardPool {
    uint256 supply;
    uint256 virtualSupply;
    uint256 magnifiedRewardPerShare;
    address validator;
    mapping(address => int256) magnifiedRewardCorrections;
    mapping(address => uint256) claimedRewards;
    mapping(address => uint256) balances;
}

/**
 * @notice data type for nodes in the red-black validator tree
 * @param parent address of the parent of this node
 * @param left the node in the tree to the left of this one
 * @param right the node in the tree to the right of this one
 * @param red bool denoting color of node for balancing
 */
struct Node {
    address parent;
    address left;
    address right;
    bool red;
    Validator validator;
}

/**
 * @notice data type for the red-black validator tree
 * @param root
 * @param count amount of nodes in the tree
 * @param totalStake total amount staked by nodes of the tree
 * @param nodes address to node mapping
 * @param delegationPools validator RewardPools by validator address
 */
struct ValidatorTree {
    address root;
    uint256 count;
    uint256 totalStake;
    mapping(address => Node) nodes;
}

struct InitStruct {
    uint256 epochReward;
    uint256 minStake;
    uint256 minDelegation;
    uint256 epochSize;
}

struct UptimeData {
    address validator;
    uint256 signedBlocks;
}

struct Uptime {
    uint256 epochId;
    UptimeData[] uptimeData;
    uint256 totalBlocks;
}

struct Epoch {
    uint256 startBlock;
    uint256 endBlock;
    bytes32 epochRoot;
}

struct Validator {
    uint256[4] blsKey;
    uint256 stake;
    uint256 liquidDebt;
    uint256 commission;
    bool active;
}

interface IValidatorSet {
    // function totalBlocks() external view returns (uint256);

    /// @notice returns a validator balance for a given epoch
    function balanceOfAt(address account, uint256 epochNumber) external view returns (uint256);

    /// @notice returns the total supply for a given epoch
    function totalSupplyAt(uint256 epochNumber) external view returns (uint256);

    function getDelegationPoolOf(address validator) external view returns (address);

    event NewEpoch(uint256 indexed id, uint256 indexed startBlock, uint256 indexed endBlock, bytes32 epochRoot);
}
