package com.acme.shop;

import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository repository;

    public UserService(UserRepository repository) {
        this.repository = repository;
    }

    public List<User> list() {
        return repository.findAll();
    }

    public User save(User user) {
        return repository.save(user);
    }
}
