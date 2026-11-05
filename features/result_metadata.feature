Feature: Result Metadata Formatting
  As the GNOME Shell Overview
  I want formatted metadata for each search result
  So that results can be displayed in the search list

  Background:
    Given Home Assistant server is configured at "http://homeassistant:8123"
    And a valid API key "test-api-key" is set
    And the following Home Assistant entities exist:
      | entity_id                 | state | friendly_name |
      | light.living_room_ceiling | on    | Living Room   |
      | light.loft_lavalamp       | off   | Lava Lamp     |
    And the "light" domain is enabled

  Scenario: Metadata resolves friendly_name from cached entity state using string result IDs
    When the user searches for "light"
    And the overview requests metadata for the results
    Then the metadata for "light.loft_lavalamp" should have:
      | id            | light.loft_lavalamp |
      | name          | Lava Lamp           |
      | description   | light.loft_lavalamp |
      | clipboardText | light.loft_lavalamp |
    And the metadata for "light.living_room_ceiling" should have:
      | id            | light.living_room_ceiling |
      | name          | Living Room               |
      | description   | light.living_room_ceiling |
      | clipboardText | light.living_room_ceiling |
