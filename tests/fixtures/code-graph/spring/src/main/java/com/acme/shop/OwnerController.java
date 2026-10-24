package com.acme.shop;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.servlet.ModelAndView;

@Controller
class OwnerController {

    private static final String VIEWS_OWNER_FORM = "owners/createOrUpdateOwnerForm";

    @GetMapping("/owners/find")
    public String initFind() {
        return "owners/findOwners";
    }

    @GetMapping("/owners/new")
    public String initCreate() {
        return VIEWS_OWNER_FORM;
    }

    @GetMapping("/owners/{id}")
    public ModelAndView show() {
        return new ModelAndView("owners/ownerDetails");
    }

    @GetMapping("/owners/back")
    public String back() {
        return "redirect:/owners/find";
    }
}
