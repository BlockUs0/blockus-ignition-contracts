// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./Blockus721Simple.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Context.sol";


contract Blockus721Factory is Ownable, Pausable, ERC2771Context {
    address[] public deployedContracts;
    mapping(address => address[]) public deployerContracts;
    mapping(address => bool) public isDeployedContract;
    address public defaultTrustedForwarder;
    uint256 public deploymentFee;

    event ContractDeployed(
        address indexed deployer,
        address indexed contractAddress,
        string name,
        string symbol,
        bool soulbound
    );

    event FeeWithdrawal(address indexed recipient, uint256 amount);

    error InvalidBatchFee(uint256 required, uint256 provided);
    error InvalidAmount(uint256 provided);
    error BatchLimitExceeded(uint256 limit, uint256 provided);
    error ArrayLengthMismatch();
    error InvalidPaginationRange(uint256 start, uint256 end, uint256 total);
    error NoFeesToWithdraw();
    error FeeWithdrawalFailed();

    /**
     * @dev Constructor
     * @param initialOwner Address of the initial owner for the factory
     * @param _defaultTrustedForwarder Address of the trusted forwarder for factory meta transactions
     * @param _deploymentFee The initial deployment fee
     */
        constructor(
            address initialOwner,
            address _defaultTrustedForwarder,
            uint256 _deploymentFee
        ) Ownable(initialOwner) ERC2771Context(_defaultTrustedForwarder) {
            defaultTrustedForwarder = _defaultTrustedForwarder;
            deploymentFee = _deploymentFee;
        }

    /**
     * @dev Deploy a new Blockus721Simple contract
     * @param name Collection name
     * @param symbol Collection symbol
     * @param baseURI Base URI for token metadata
     * @param contractOwner Address of the initial owner for the new NFT contract
     * @param isSoulbound Whether tokens are soulbound (non-transferable)
     * @return The address of the newly deployed contract
     */
    function deployNFT(
        string memory name,
        string memory symbol,
        string memory baseURI,
        address contractOwner,
        bool isSoulbound
    ) external payable whenNotPaused returns (address) {
        if (msg.value < deploymentFee) {
            revert InvalidBatchFee(deploymentFee, msg.value);
        }

        Blockus721Simple newNFT = new Blockus721Simple(
            name,
            symbol,
            baseURI,
            contractOwner,
            defaultTrustedForwarder,
            isSoulbound
        );

        address newNFTAddress = address(newNFT);
        address deployer = _msgSender();

        deployedContracts.push(newNFTAddress);
        deployerContracts[deployer].push(newNFTAddress);
        isDeployedContract[newNFTAddress] = true;

        emit ContractDeployed(
            deployer,
            newNFTAddress,
            name,
            symbol,
            isSoulbound
        );

        return newNFTAddress;
    }

    /**
     * @dev Batch deploy multiple Blockus721Simple contracts
     * @param names Array of collection names
     * @param symbols Array of collection symbols
     * @param baseURIs Array of base URIs
     * @param contractOwners Array of initial owners for the new NFT contracts
     * @param isSoulbounds Array of soulbound statuses
     * @return Array of addresses of the newly deployed contracts
     */
    function batchDeploy(
        string[] memory names,
        string[] memory symbols,
        string[] memory baseURIs,
        address[] memory contractOwners,
        bool[] memory isSoulbounds
    ) external payable whenNotPaused returns (address[] memory) {
        uint256 count = names.length;
        if (count == 0) {
            revert InvalidAmount(0);
        }
        if (count > 20) {
            revert BatchLimitExceeded(20, count);
        }
        if (symbols.length != count || baseURIs.length != count || contractOwners.length != count || isSoulbounds.length != count) {
            revert ArrayLengthMismatch();
        }
        if (msg.value < deploymentFee * count) {
            revert InvalidBatchFee(deploymentFee * count, msg.value);
        }

        address[] memory newNFTAddresses = new address[](count);
        address deployer = _msgSender();

        for (uint256 i = 0; i < count; i++) {
             Blockus721Simple newNFT = new Blockus721Simple(
                names[i],
                symbols[i],
                baseURIs[i],
                contractOwners[i],
                defaultTrustedForwarder, 
                isSoulbounds[i]
            );

            address newNFTAddress = address(newNFT);
            newNFTAddresses[i] = newNFTAddress;

            deployedContracts.push(newNFTAddress);
            deployerContracts[deployer].push(newNFTAddress);
            isDeployedContract[newNFTAddress] = true;

            emit ContractDeployed(
                deployer,
                newNFTAddress,
                names[i],
                symbols[i],
                isSoulbounds[i]
            );
        }

        return newNFTAddresses;
    }

    /**
     * @dev Get contracts deployed by a specific address
     * @param deployer The deployer address
     * @return Array of contract addresses deployed by the deployer
     */
    function getDeployerContracts(address deployer) external view returns (address[] memory) {
        return deployerContracts[deployer];
    }

    /**
     * @dev Get the total number of deployed contracts
     * @return Total count of deployed contracts
     */
    function getTotalDeployedContracts() external view returns (uint256) {
        return deployedContracts.length;
    }

    /**
     * @dev Get a paginated list of deployed contracts
     * @param start The starting index (0-based)
     * @param end The ending index (exclusive)
     * @return Array of contract addresses
     */
    function getDeployedContracts(uint256 start, uint256 end) external view returns (address[] memory) {
        if (end < start || end > deployedContracts.length) {
             revert InvalidPaginationRange(start, end, deployedContracts.length);
        }

        uint256 count = end - start;
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = deployedContracts[start + i];
        }
        return result;
    }

    /**
     * @dev Set the deployment fee (owner only)
     * @param newFee The new deployment fee
     */
    function setDeploymentFee(uint256 newFee) external onlyOwner {
        deploymentFee = newFee;
    }

    /**
     * @dev Set the default trusted forwarder address (owner only)
     * @param newForwarder The new trusted forwarder address
     */
    function setDefaultTrustedForwarder(address newForwarder) external onlyOwner {
        // Note: This only affects *future* deployed contracts.
        defaultTrustedForwarder = newForwarder;
    }

    /**
     * @dev Pause the factory (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the factory (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Withdraw collected fees (owner only)
     * @param recipient The address to send fees to
     */
    function withdrawFees(address recipient) external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) {
            revert NoFeesToWithdraw();
        }
        (bool success, ) = payable(recipient).call{value: balance}("");
        if (!success) {
            revert FeeWithdrawalFailed();
        }
        emit FeeWithdrawal(recipient, balance);
    }

    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view virtual override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
}