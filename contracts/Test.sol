// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract Animal is Initializable {
    function __Animal_init() internal onlyInitializing {
        // Most base contract
        __Animal_init_unchained();
    }

    function __Animal_init_unchained() internal onlyInitializing {
        // Initialization logic for Animal
    }
}

contract ThinkingExtension is Initializable {
    function __ThinkingExtension_init() internal onlyInitializing {
        __ThinkingExtension_init_unchained();
    }

    function __ThinkingExtension_init_unchained() internal onlyInitializing {
        // Initialization logic for ThinkingExtension
    }
}

contract Human is Animal, ThinkingExtension {
    function __Human_init() internal onlyInitializing {
        // Human is the only child that inherits ThinkingExtension
        __ThinkingExtension_init();
        __Human_init_unchained();
    }

    function __Human_init_unchained() internal onlyInitializing {
        // Initialization logic for Human
    }
}

contract HorseExtension is Initializable {
    function __HorseExtension_init() internal onlyInitializing {
        // Most base contract
        __HorseExtension_init_unchained();
    }

    function __HorseExtension_init_unchained() internal onlyInitializing {
        // Initialization logic for HorseExtension
    }
}

contract FastRunnerExtension is HorseExtension {
    function __FastRunnerExtension_init() internal onlyInitializing {
        // We don't initialize HorseExtension here, because there is another child that inherits from it on the same level
        __FastRunnerExtension_init_unchained();
    }

    function __FastRunnerExtension_init_unchained() internal onlyInitializing {
        // Initialization logic for FastRunnerExtension
    }
}

contract SaddleExtension is HorseExtension {
    function __SaddleExtension_init() internal onlyInitializing {
        // We don't initialize HorseExtension here, because there is another child that inherits from it on the same level
        __SaddleExtension_init_unchained();
    }

    function __SaddleExtension_init_unchained() internal onlyInitializing {
        // Initialization logic for SaddleExtension
    }
}

contract Horse is Animal, HorseExtension, FastRunnerExtension, SaddleExtension {
    function __Horse_init() internal onlyInitializing {
        // The Horse contract wraps all contracts that inherit from HorseExtension.
        // Therefore, we initialize HorseExtension here.
        __HorseExtension_init();
        __FastRunnerExtension_init();
        __SaddleExtension_init();
        __Horse_init_unchained();
    }

    function __Horse_init_unchained() internal onlyInitializing {
        // Initialization logic for Horse
    }
}

contract Centaur is Animal, Human, Horse {
    function initialize() public initializer {
        // The Centaur contract wraps all contracts that inherit from Animal.
        // Therefore, we initialize Animal here.
        __Animal_init();
        __Human_init();
        __Horse_init();
        // Initialization logic for Centaur
    }
}
