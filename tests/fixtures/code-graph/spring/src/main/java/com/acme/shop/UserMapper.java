package com.acme.shop;

import java.util.function.Function;

public interface UserMapper extends Function<User, UserDto> {
}
