Feature: Activate Entity from Search
  As a GNOME user
  I want to activate a search result
  So that the corresponding Home Assistant device is toggled

  Background:
    Given Home Assistant server is configured at "http://homeassistant:8123"
    And a valid API key "test-api-key" is set

  Scenario Outline: Activating an entity sends toggle service call
    When the user activates the result "<entity_id>"
    Then a POST request should be sent to "http://homeassistant:8123/api/services/<domain>/toggle"
    And the request should have header "authorization" with bearer token "test-api-key"
    And the request body should be:
      """
      {"entity_id":"<entity_id>"}
      """

    Examples:
      | entity_id           | domain |
      | light.loft_lavalamp | light  |
      | switch.coffee_maker | switch |
