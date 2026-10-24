package com.acme.shop;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class StatusController {

    @GetMapping("/status")
    public String status() {
        return "owners/findOwners";
    }
}
