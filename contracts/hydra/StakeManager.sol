// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./IStakeManager.sol";
import "../interfaces/common/IBLS.sol";

contract StakeManager is IStakeManager, Initializable, Ownable2StepUpgradeable {
    using SafeERC20 for IERC20;

    IERC20 internal stakingToken;
    address private validatorSet;

    IBLS private bls;

    bytes32 public domain;

    mapping(address => Validator) public validators;

    modifier onlyValidator(address validator) {
        if (!validators[validator].isActive) revert Unauthorized("VALIDATOR");
        _;
    }

    function initialize(
        address newStakingToken,
        address newBls,
        address newValidatorSet,
        string memory newDomain
    ) public initializer {
        require(
            newStakingToken != address(0) &&
                newBls != address(0) &&
                newValidatorSet != address(0) &&
                bytes(newDomain).length != 0,
            "INVALID_INPUT"
        );

        stakingToken = IERC20(newStakingToken);
        bls = IBLS(newBls);
        validatorSet = newValidatorSet;
        domain = keccak256(abi.encode(newDomain));
    }

    function whitelistValidators(address[] calldata validators_) external onlyOwner {
        uint256 length = validators_.length;
        for (uint256 i = 0; i < length; i++) {
            _addToWhitelist(validators_[i]);
        }
    }

    function register(uint256[2] calldata signature, uint256[4] calldata pubkey) external {
        Validator storage validator = validators[msg.sender];
        if (!validator.isWhitelisted) revert Unauthorized("WHITELIST");
        _verifyValidatorRegistration(msg.sender, signature, pubkey);
        validator.blsKey = pubkey;
        validator.isActive = true;
        _removeFromWhitelist(msg.sender);
        emit ValidatorRegistered(msg.sender, pubkey);
    }

    function withdrawSlashedStake(address to) external onlyOwner {
        uint256 balance = matic.balanceOf(address(this));
        matic.safeTransfer(to, balance);
    }

    /**
     * @inheritdoc IStakeManager
     */
    function stake(uint256 amount) external {
        // slither-disable-next-line reentrancy-benign,reentrancy-events
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        // calling the library directly once fixes the coverage issue
        // https://github.com/foundry-rs/foundry/issues/4854#issuecomment-1528897219
        _addStake(msg.sender, id, amount);
        ISupernetManager manager = managerOf(id);
        manager.onStake(msg.sender, amount);
        // slither-disable-next-line reentrancy-events
        emit StakeAdded(id, msg.sender, amount);
    }

    /**
     * @inheritdoc IStakeManager
     */
    function releaseStakeOf(address validator, uint256 amount) external {
        uint256 id = idFor(msg.sender);
        _removeStake(validator, id, amount);
        // slither-disable-next-line reentrancy-events
        emit StakeRemoved(id, validator, amount);
    }

    /**
     * @inheritdoc IStakeManager
     */
    function withdrawStake(address to, uint256 amount) external {
        _withdrawStake(msg.sender, to, amount);
    }

    /**
     * @inheritdoc IStakeManager
     */
    function slashStakeOf(address validator, uint256 amount) external {
        uint256 id = idFor(msg.sender);
        uint256 stake = _stakeOf(validator, id);
        if (amount > stake) amount = stake;
        _removeStake(validator, id, stake);
        _withdrawStake(validator, msg.sender, amount);
        emit StakeRemoved(id, validator, stake);
        emit ValidatorSlashed(id, validator, amount);
    }

    /**
     * @inheritdoc IStakeManager
     */
    function withdrawableStake(address validator) external view returns (uint256 amount) {
        amount = _withdrawableStakeOf(validator);
    }

    /**
     * @inheritdoc IStakeManager
     */
    function totalStake() external view returns (uint256 amount) {
        amount = _totalStake;
    }

    /**
     * @inheritdoc IStakeManager
     */
    function totalStakeOf(address validator) external view returns (uint256 amount) {
        amount = _totalStakeOf(validator);
    }

    /**
     * @inheritdoc IStakeManager
     */
    function stakeOf(address validator, uint256 id) public view returns (uint256 amount) {
        amount = _stakeOf(validator, id);
    }

    function _withdrawStake(address validator, address to, uint256 amount) private {
        _withdrawStake(validator, amount);
        // slither-disable-next-line reentrancy-events
        stakingToken.safeTransfer(to, amount);
        emit StakeWithdrawn(validator, to, amount);
    }

    function getValidator(address validator_) external view returns (Validator memory) {
        return validators[validator_];
    }

    function _addToWhitelist(address validator) internal {
        validators[validator].isWhitelisted = true;
        emit AddedToWhitelist(validator);
    }

    function _removeFromWhitelist(address validator) internal {
        validators[validator].isWhitelisted = false;
        emit RemovedFromWhitelist(validator);
    }

    function _removeIfValidatorUnstaked(address validator) internal {
        if (stakeManager.stakeOf(validator, id) == 0) {
            validators[validator].isActive = false;
            emit ValidatorDeactivated(validator);
        }
    }

    // slither-disable-next-line unused-state,naming-convention
    uint256[50] private __gap;
}
