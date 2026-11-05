Feature: Entity Action Expansion and State Control
  As a GNOME user
  I want to use the "!" token to expand and filter entity actions and attributes
  So that I can control device states and attributes directly from GNOME search

  Background:
    Given Home Assistant server is configured at "http://homeassistant:8123"
    And a valid API key "test-api-key" is set
    And the following Home Assistant entities exist with attributes:
      | entity_id           | state | friendly_name | attributes_json                                                      |
      | light.loft_lavalamp | on    | Lava Lamp     | {"brightness": 204, "color_temp_kelvin": 3000}                       |
      | switch.coffee_maker | off   | Coffee        | {}                                                                   |
      | climate.living_room | heat  | AC            | {"temperature": 21, "hvac_modes": ["off", "heat", "cool", "auto"]}   |
      | cover.garage_door   | open  | Garage Door   | {"current_position": 100}                                            |
    And the "light" domain is enabled
    And the "switch" domain is enabled
    And the "climate" domain is enabled
    And the "cover" domain is enabled

  Scenario: Appending "!" to an entity query expands it into multiple action results
    When the user searches for "loft!"
    And the overview requests metadata for the results
    Then the search results should include actions for "light.loft_lavalamp":
      | id                                 | name                          | description                          |
      | light.loft_lavalamp!light.turn_on  | Lava Lamp → Turn On           | light.loft_lavalamp (light.turn_on)  |
      | light.loft_lavalamp!light.turn_off | Lava Lamp → Turn Off          | light.loft_lavalamp (light.turn_off) |
      | light.loft_lavalamp!light.toggle   | Lava Lamp → Toggle            | light.loft_lavalamp (light.toggle)   |

  Scenario: Space-separated "!" also expands an entity into action results and activates selected action
    When the user searches for "loft !"
    Then the search results should contain "light.loft_lavalamp!light.turn_off"
    When the user activates the result "light.loft_lavalamp!light.turn_off"
    Then a POST request should be sent to "http://homeassistant:8123/api/services/light/turn_off"
    And the request body should be:
      """
      {"entity_id":"light.loft_lavalamp"}
      """

  Scenario Outline: Setting light brightness via attached or space-separated percentage token
    When the user searches for "<query>"
    And the overview requests metadata for the results
    Then the search results should include actions for "light.loft_lavalamp":
      | id                                                     | name                               |
      | light.loft_lavalamp!light.turn_on:{"brightness_pct":40} | Lava Lamp → Set brightness to 40% |
    When the user activates the first search result
    Then a POST request should be sent to "http://homeassistant:8123/api/services/light/turn_on"
    And the request body should be:
      """
      {"entity_id":"light.loft_lavalamp","brightness_pct":40}
      """

    Examples:
      | query      |
      | loft!40%   |
      | loft !40%  |
      | loft ! 40% |

  Scenario: Setting climate temperature and HVAC mode via shorthand tokens
    When the user searches for "climate.living_room!22c"
    When the user activates the first search result
    Then a POST request should be sent to "http://homeassistant:8123/api/services/climate/set_temperature"
    And the request body should be:
      """
      {"entity_id":"climate.living_room","temperature":22}
      """
    When the user searches for "climate.living_room ! cool"
    And the user activates the first search result
    Then a POST request should be sent to "http://homeassistant:8123/api/services/climate/set_hvac_mode"
    And the request body should be:
      """
      {"entity_id":"climate.living_room","hvac_mode":"cool"}
      """

  Scenario: Setting cover position or opening/closing via shorthand tokens
    When the user searches for "garage!50%"
    And the user activates the first search result
    Then a POST request should be sent to "http://homeassistant:8123/api/services/cover/set_cover_position"
    And the request body should be:
      """
      {"entity_id":"cover.garage_door","position":50}
      """
    When the user searches for "garage ! close"
    And the user activates the first search result
    Then a POST request should be sent to "http://homeassistant:8123/api/services/cover/close_cover"
    And the request body should be:
      """
      {"entity_id":"cover.garage_door"}
      """

  Scenario: Expanding an entity with "!" lists controllable attributes and narrows by attribute key
    When the user searches for "loft!"
    And the overview requests metadata for the results
    Then the search results should include actions for "light.loft_lavalamp":
      | id                                               | name                                     |
      | light.loft_lavalamp!attr:brightness              | Lava Lamp → Brightness (current: 80%)    |
      | light.loft_lavalamp!attr:color_temp_kelvin       | Lava Lamp → Color Temp Kelvin (current: 3000) |
    When the user refines the search to "loft!bright"
    Then the search results should contain "light.loft_lavalamp!attr:brightness"

  Scenario Outline: Providing an attribute key and value after "!" binds the attribute value to the service call
    When the user searches for "<query>"
    And the user activates the first search result
    Then a POST request should be sent to "<expected_url>"
    And the request body should be:
      """
      <expected_body>
      """

    Examples:
      | query                                  | expected_url                                                    | expected_body                                                    |
      | loft ! brightness 65                   | http://homeassistant:8123/api/services/light/turn_on            | {"entity_id":"light.loft_lavalamp","brightness_pct":65}          |
      | loft!brightness=65                     | http://homeassistant:8123/api/services/light/turn_on            | {"entity_id":"light.loft_lavalamp","brightness_pct":65}          |
      | loft ! color_temp_kelvin 2700          | http://homeassistant:8123/api/services/light/turn_on            | {"entity_id":"light.loft_lavalamp","color_temp_kelvin":2700}     |
      | climate.living_room ! temperature 23.5 | http://homeassistant:8123/api/services/climate/set_temperature  | {"entity_id":"climate.living_room","temperature":23.5}           |
      | climate.living_room ! hvac_mode auto   | http://homeassistant:8123/api/services/climate/set_hvac_mode    | {"entity_id":"climate.living_room","hvac_mode":"auto"}           |
      | garage ! position 75                   | http://homeassistant:8123/api/services/cover/set_cover_position | {"entity_id":"cover.garage_door","position":75}                  |

  Scenario: Dynamically discovering services and fields from /api/services for custom domains
    Given the "vacuum" domain is enabled
    And the following Home Assistant entities exist with attributes:
      | entity_id         | state  | friendly_name | attributes_json                   |
      | vacuum.robo_clean | docked | RoboVac       | {"fan_speed": "Balanced"}         |
    And the Home Assistant "/api/services" endpoint returns:
      """
      [
        {
          "domain": "vacuum",
          "services": {
            "start": { "name": "Start", "fields": {} },
            "return_to_base": { "name": "Return to base", "fields": {} },
            "set_fan_speed": {
              "name": "Set fan speed",
              "fields": {
                "fan_speed": { "description": "Fan speed value" }
              }
            }
          }
        }
      ]
      """
    When the user searches for "robo!"
    Then the search results should contain "vacuum.robo_clean!vacuum.start"
    And the search results should contain "vacuum.robo_clean!vacuum.return_to_base"
    When the user refines the search to "robo ! fan_speed Turbo"
    And the user activates the first search result
    Then a POST request should be sent to "http://homeassistant:8123/api/services/vacuum/set_fan_speed"
    And the request body should be:
      """
      {"entity_id":"vacuum.robo_clean","fan_speed":"Turbo"}
      """

  Scenario Outline: Domain-appropriate default activation when no "!" token is used
    Given the "<domain>" domain is enabled
    And the following Home Assistant entities exist with attributes:
      | entity_id   | state   | friendly_name | attributes_json |
      | <entity_id> | <state> | <name>        | {}              |
    When the user searches for "<entity_id>"
    And the user activates the result "<entity_id>"
    Then a POST request should be sent to "http://homeassistant:8123/api/services/<domain>/<expected_service>"
    And the request body should be:
      """
      {"entity_id":"<entity_id>"}
      """

    Examples:
      | domain     | entity_id             | state    | name       | expected_service |
      | scene      | scene.movie_night     | scening  | Movie      | turn_on          |
      | script     | script.goodnight      | off      | Goodnight  | turn_on          |
      | button     | button.doorbell_chime | unknown  | Chime      | press            |
      | automation | automation.morning    | on       | Morning    | trigger          |
      | lock       | lock.front_door       | locked   | Front Door | unlock           |
      | lock       | lock.back_door        | unlocked | Back Door  | lock             |



