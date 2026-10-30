Feature: Search Home Assistant Entities
  As a GNOME user
  I want to search for Home Assistant devices from the GNOME search bar
  So that I can quickly find devices connected to my home

  Background:
    Given Home Assistant server is configured at "http://homeassistant:8123"
    And a valid API key "test-api-key" is set
    And the following Home Assistant entities exist:
      | entity_id                 | state |
      | light.living_room_ceiling | on    |
      | light.loft_lavalamp       | off   |
      | switch.coffee_maker       | off   |
      | sensor.outside_temp       | 18.5  |
      | climate.living_room       | heat  |

  Scenario: Searching by a single term matches entity IDs case-insensitively
    Given the "lights" domain is enabled
    When the user searches for "loft"
    Then the search results should be:
      | light.loft_lavalamp |

  Scenario: Searching with multiple terms matches all terms
    Given the "lights" domain is enabled
    When the user searches for "living ceiling"
    Then the search results should be:
      | light.living_room_ceiling |

  Scenario: Entities from disabled domains are excluded
    Given the "lights" domain is enabled
    And the "switches" domain is disabled
    When the user searches for "coffee"
    Then the search results should be empty

  Scenario: Entities from unsupported domains are excluded
    Given the "lights" domain is enabled
    And the "switches" domain is enabled
    When the user searches for "climate"
    Then the search results should be empty

  Scenario: Search results are capped by maximum results
    Given the "lights" domain is enabled
    And the "switches" domain is enabled
    When the user searches for "l"
    And the search provider limits results to 1
    Then exactly 1 result should be returned
