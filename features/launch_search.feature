Feature: Launch Search in Browser
  As a GNOME user
  I want to launch the main search action
  So that I can open the Home Assistant web interface

  Scenario: Launching search opens Home Assistant server URL
    Given Home Assistant server is configured at "http://homeassistant:8123"
    And a valid API key "test-api-key" is set
    When the user launches the search provider
    Then the system default browser should be launched with "http://homeassistant:8123"
