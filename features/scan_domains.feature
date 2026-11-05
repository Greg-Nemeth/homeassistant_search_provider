Feature: Scan Home Assistant Domains in Preferences
  As a GNOME user
  I want to scan my Home Assistant instance for available domains in the preferences window
  So that I can dynamically choose which entity domains to filter on

  Background:
    Given Home Assistant server is configured at "http://homeassistant:8123"
    And a valid API key "test-api-key" is set
    And the following Home Assistant entities exist:
      | entity_id                 | state | friendly_name |
      | light.living_room_ceiling | on    | Living Room   |
      | light.loft_lavalamp       | off   | Lava Lamp     |
      | switch.coffee_maker       | off   | Coffee        |
      | sensor.outside_temp       | 18.5  | Weather       |
      | climate.living_room       | heat  | AC            |

  Scenario: Services group is initially empty before the first scan
    When the user opens the preferences window
    Then the services group should contain 0 domain switches

  Scenario: Clicking Scan populates the Services group with unique domains disabled by default
    Given the user opens the preferences window
    When the user clicks the Scan Domains button
    Then a GET request should be sent to "http://homeassistant:8123/api/states"
    And the request should have header "authorization" with bearer token "test-api-key"
    And the services group should contain the following domain switches:
      | domain  | active |
      | climate | false  |
      | light   | false  |
      | sensor  | false  |
      | switch  | false  |

  Scenario: Toggling a scanned domain persists in settings and is preserved on re-scan
    Given the user opens the preferences window
    And the user clicks the Scan Domains button
    When the user toggles the "light" domain switch to enabled
    And the user clicks the Scan Domains button
    Then the services group should contain the following domain switches:
      | domain  | active |
      | climate | false  |
      | light   | true   |
      | sensor  | false  |
      | switch  | false  |
