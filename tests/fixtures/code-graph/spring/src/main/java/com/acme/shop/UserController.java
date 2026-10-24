package com.acme.shop;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/api")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private RestTemplate http;

    private final OrderService orders;

    public UserController(OrderService orders, String region) {
        this.orders = orders;
    }

    @GetMapping("/users")
    public List<User> list() {
        return userService.list();
    }

    @Deprecated
    @PostMapping(value = "/users")
    public User create(@RequestBody User user) {
        return userService.save(user);
    }

    @RequestMapping(value = "/legacy", method = RequestMethod.GET)
    public String legacy() {
        return "legacy";
    }

    @DeleteMapping("/users/{id}")
    public void remove(@PathVariable Long id) {
    }
}
