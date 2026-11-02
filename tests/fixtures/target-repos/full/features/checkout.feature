Feature: checkout

  Scenario: a paid order is confirmed
    Given a cart with one item
    When the customer pays
    Then the order is confirmed
