Feature: Result Metadata Formatting
  As the GNOME Shell Overview
  I want formatted metadata for each search result
  So that results can be displayed in the search list

  Background:
    Given Home Assistant server is configured at "http://homeassistant:8123"
    And a valid API key "test-api-key" is set

  Scenario: Metadata contains identifier and basic display attributes
    Given the search provider has matching results:
      | entity_id 			| friendly_name | state |
      | light.loft_lavalamp | Lava Lamp		| on	|
    When the overview requests metadata for the results
    Then the metadata for "light.loft_lavalamp" should have:
      | id            | light.loft_lavalamp |
      | name          | Lava Lamp		    |
      | description   | light.loft_lavalamp |
      | clipboardText | light.loft_lavalamp |
