// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./ERC721A.sol";
import "./openzeppelin/contracts/access/Ownable.sol";
import "./openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

error ERC20LowBalance();

contract Hekima is Ownable, ReentrancyGuard, ERC721A {
    uint256 public constant PRICE = 13 * 1e6; // 13 USDC, 6 decimals
    address public constant USDC = 0xcebA9300f2b948710d2653dD7B07f33A8B32118C;
    uint256 public immutable MAX_WALLET_MINTS = 10;
    string public _baseTokenURI = "https://arweave.net/fJ04WdKY6XO7A8Ebmz5NsPvH0bTlA_lg4V5qtZfLaN0";

    constructor(string memory tokenName, string memory tokenSymbol) {
        ERC721A._init(tokenName, tokenSymbol, 10, 1000);
        Ownable._transferOwnership(msg.sender);
    }

    function permitAndMint(
        uint256 _amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        if (_amount == 0) revert MintZeroQuantity();
        if (_amount > maxBatchSize) revert TransactionCapExceeded();
        if (_numberMinted(msg.sender) + _amount > MAX_WALLET_MINTS) revert TransactionCapExceeded();
        if (currentTokenId() + _amount > collectionSize) revert TransactionCapExceeded();

        uint256 totalCost = PRICE * _amount;
        IERC20Permit usdc = IERC20Permit(USDC);

        if (usdc.balanceOf(msg.sender) < totalCost) revert ERC20LowBalance();

        usdc.permit(msg.sender, address(this), totalCost, deadline, v, r, s);

        bool success = usdc.transferFrom(msg.sender, address(this), totalCost);
        if (!success) revert ERC20TransferFailed();

        _safeMint(msg.sender, _amount, false);
    }

    function tokenURI(uint256) public view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function withdrawUSDC() external onlyOwner {
        IERC20Permit usdc = IERC20Permit(USDC);
        uint256 balance = usdc.balanceOf(address(this));
        if (balance > 0) {
            bool success = usdc.transfer(msg.sender, balance);
            if (!success) revert ERC20TransferFailed();
        }
    }
}
