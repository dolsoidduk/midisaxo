/*

Copyright Igor Petrovic

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

*/

#include "application/database/database.h"
#include "application/io/buttons/common.h"
#include "application/io/analog/common.h"
#include "application/io/leds/common.h"
#include "application/protocol/midi/common.h"

using namespace database;
using namespace io;
using namespace protocol;

// each new group of components should have their IDs start from 0

void Admin::customInitGlobal()
{
    // set global channel to 1
    update(Config::Section::global_t::MIDI_SETTINGS, midi::setting_t::GLOBAL_CHANNEL, 1);

    // Custom system setting index 11: sax transpose raw value 0..48 (= -24..+24 semis).
    // Default to 0 semis (raw 24) on factory reset.
    // Note: use MSB as an internal "initialized" flag (masked out from UI).
    update(Config::Section::system_t::SYSTEM_SETTINGS, 11, static_cast<uint16_t>(0x8000u | 24u));

    // Custom system setting index 12: pitch bend deadzone around captured center.
    // Higher value = less sensitive around center.
    update(Config::Section::system_t::SYSTEM_SETTINGS, 12, 100);

    // Custom system setting index 13: stored pitch bend center (player calibration).
    update(Config::Section::system_t::SYSTEM_SETTINGS, 13, 8192);

    // Custom system setting index 14: sax auto vibrato enable (0/1).
    update(Config::Section::system_t::SYSTEM_SETTINGS, 14, 0);

    // Custom system setting index 15: sax auto vibrato gate threshold (14-bit delta above center).
    // Vibrato turns on only when PB value goes above (8192 + threshold).
    update(Config::Section::system_t::SYSTEM_SETTINGS, 15, 300);

    // Custom system setting index 16: sax auto vibrato depth (14-bit, peak amplitude).
    update(Config::Section::system_t::SYSTEM_SETTINGS, 16, 200);

    // Custom system setting index 17: sax auto vibrato rate (Hz * 10). Example: 60 = 6.0 Hz.
    update(Config::Section::system_t::SYSTEM_SETTINGS, 17, 60);

    // Custom system setting index 18: sax auto vibrato analog index (which PITCH_BEND input to modulate).
    // midisaxo_pico default PB sensor index is 2.
    update(Config::Section::system_t::SYSTEM_SETTINGS, 18, 2);
}

void Admin::customInitButtons()
{
    for (size_t group = 0; group < buttons::Collection::GROUPS(); group++)
    {
        for (size_t i = 0; i < buttons::Collection::SIZE(group); i++)
        {
            update(Config::Section::button_t::MIDI_ID, i + buttons::Collection::START_INDEX(group), i);
        }
    }
}

void Admin::customInitAnalog()
{
    for (size_t group = 0; group < analog::Collection::GROUPS(); group++)
    {
        for (size_t i = 0; i < analog::Collection::SIZE(group); i++)
        {
            update(Config::Section::analog_t::MIDI_ID, i + analog::Collection::START_INDEX(group), i);
        }
    }
}

void Admin::customInitLEDs()
{
    for (size_t group = 0; group < leds::Collection::GROUPS(); group++)
    {
        for (size_t i = 0; i < leds::Collection::SIZE(group); i++)
        {
            update(Config::Section::leds_t::ACTIVATION_ID, i + leds::Collection::START_INDEX(group), i);
            update(Config::Section::leds_t::CONTROL_TYPE, i + leds::Collection::START_INDEX(group), leds::controlType_t::MIDI_IN_NOTE_MULTI_VAL);
        }
    }
}