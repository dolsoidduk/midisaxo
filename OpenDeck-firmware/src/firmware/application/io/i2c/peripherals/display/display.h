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

#pragma once

#include "deps.h"
#include "element.h"
#include "strings.h"
#include "application/messaging/messaging.h"
#include "application/system/config.h"
#include "application/protocol/midi/common.h"

#include "core/util/util.h"
#include <u8x8.h>

#include <bits/char_traits.h>
#include <optional>

namespace io::i2c::display
{
    class Display : public Peripheral
    {
        public:
        Display(Hwa&      hwa,
                Database& database,
                database::Admin& admin);

        bool init() override;
        void update() override;

        private:
        static constexpr uint8_t MAX_ROWS         = 4;
        static constexpr uint8_t MAX_COLUMNS      = 16;
        static constexpr uint8_t COLUMN_PADDING   = 1;
        static constexpr size_t  U8X8_BUFFER_SIZE = 32;

        using rowMapArray_t     = std::array<std::array<uint8_t, MAX_ROWS>, static_cast<uint8_t>(displayResolution_t::AMOUNT)>;
        using i2cAddressArray_t = std::array<uint8_t, 2>;

        static constexpr rowMapArray_t ROW_MAP = {
            {
                /// Array holding remapped values of LCD rows.
                /// Used to increase readability.
                /// Matched with displayResolution_t enum.

                // 128x32
                {
                    0,
                    1,
                    2,
                    3,
                },
                // 128x64
                {
                    0,
                    3,
                    5,
                    7,
                },
            },
        };

        static constexpr i2cAddressArray_t I2C_ADDRESS = {
            0x3C,
            0x3D,
        };

        class Elements
        {
            public:
            Elements(Display& display)
                : _display(display)
            {}

            using elementsVec_t = std::vector<DisplayTextControl*>;

            static constexpr uint16_t REFRESH_TIME = 30;

            class MIDIUpdater
            {
                public:
                MIDIUpdater() = default;

                void useAlternateNote(bool state);
                void updateMIDIValue(DisplayTextControl& element, const messaging::Event& event);

                private:
                bool _useAlternateNote = false;
            };

            class MessageTypeIn : public DisplayElement<12, 0, 1, true>
            {
                public:
                MessageTypeIn()
                {
                    MidiDispatcher.listen(messaging::eventType_t::MIDI_IN,
                                          [this](const messaging::Event& event)
                                          {
                                              if (event.message != protocol::midi::messageType_t::SYS_EX)
                                              {
                                                  setText("%s", Strings::MIDI_MESSAGE(event.message));
                                              }
                                          });
                }
            };

            class MessageValueIn : public DisplayElement<12, 1, 0, true>
            {
                public:
                MessageValueIn(MIDIUpdater& midiUpdater)
                    : _midiUpdater(midiUpdater)
                {
                    MidiDispatcher.listen(messaging::eventType_t::MIDI_IN,
                                          [this](const messaging::Event& event)
                                          {
                                              if (event.message != protocol::midi::messageType_t::SYS_EX)
                                              {
                                                  _midiUpdater.updateMIDIValue(*this, event);
                                              }
                                          });
                }

                private:
                MIDIUpdater& _midiUpdater;
            };

            class MessageTypeOut : public DisplayElement<12, 2, 1, true>
            {
                public:
                MessageTypeOut()
                {
                    MidiDispatcher.listen(messaging::eventType_t::ANALOG,
                                          [this](const messaging::Event& event)
                                          {
                                              setText("%s", Strings::MIDI_MESSAGE(event.message));
                                          });

                    MidiDispatcher.listen(messaging::eventType_t::BUTTON,
                                          [this](const messaging::Event& event)
                                          {
                                              setText("%s", Strings::MIDI_MESSAGE(event.message));
                                          });

                    MidiDispatcher.listen(messaging::eventType_t::ENCODER,
                                          [this](const messaging::Event& event)
                                          {
                                              setText("%s", Strings::MIDI_MESSAGE(event.message));
                                          });
                }
            };

            class MessageValueOut : public DisplayElement<12, 3, 0, true>
            {
                public:
                MessageValueOut(MIDIUpdater& midiUpdater)
                    : _midiUpdater(midiUpdater)
                {
                    MidiDispatcher.listen(messaging::eventType_t::ANALOG,
                                          [this](const messaging::Event& event)
                                          {
                                              _midiUpdater.updateMIDIValue(*this, event);
                                          });

                    MidiDispatcher.listen(messaging::eventType_t::BUTTON,
                                          [this](const messaging::Event& event)
                                          {
                                              _midiUpdater.updateMIDIValue(*this, event);
                                          });

                    MidiDispatcher.listen(messaging::eventType_t::ENCODER,
                                          [this](const messaging::Event& event)
                                          {
                                              _midiUpdater.updateMIDIValue(*this, event);
                                          });
                }

                private:
                MIDIUpdater& _midiUpdater;
            };

            class Preset : public DisplayElement<3, 0, 12, false>
            {
                public:
                Preset()
                {
                    MidiDispatcher.listen(messaging::eventType_t::SYSTEM,
                                          [this](const messaging::Event& event)
                                          {
                                              if (event.systemMessage == messaging::systemMessage_t::PRESET_CHANGED)
                                              {
                                                  setPreset(event.index + 1);
                                              }
                                          });
                }

                void setPreset(uint8_t preset)
                {
                    setText("P%d", preset);
                }
            };

            class BigNote
            {
                public:
                BigNote()
                {
                    setFixed("----");

                    // Emphasize most recent outgoing NOTE_ON.
                    // "Outgoing" in OpenDeck terms means locally generated events (analog/buttons/encoders).
                    auto handle = [this](const messaging::Event& event)
                    {
                        if (event.message != protocol::midi::messageType_t::NOTE_ON)
                        {
                            return;
                        }

                        if (event.value == 0)
                        {
                            return;
                        }

                        char temp[8] = {};
                        snprintf(temp,
                                 sizeof(temp),
                                 "%s%d",
                                 Strings::NOTE(protocol::midi::NOTE_TO_TONIC(event.index)),
                                 protocol::midi::NOTE_TO_OCTAVE(event.index));

                        char fixed[5] = { ' ', ' ', ' ', ' ', '\0' };
                        for (size_t i = 0; (i < 4) && (temp[i] != '\0'); i++)
                        {
                            fixed[i] = temp[i];
                        }

                        setFixed(fixed);
                    };

                    MidiDispatcher.listen(messaging::eventType_t::ANALOG, handle);
                    MidiDispatcher.listen(messaging::eventType_t::BUTTON, handle);
                    MidiDispatcher.listen(messaging::eventType_t::ENCODER, handle);
                }

                const char* text() const
                {
                    return _text;
                }

                bool dirty() const
                {
                    return _dirty;
                }

                void clearDirty()
                {
                    _dirty = false;
                }

                private:
                void setFixed(const char* text)
                {
                    if (strncmp(_text, text, sizeof(_text)) == 0)
                    {
                        return;
                    }

                    strncpy(_text, text, sizeof(_text) - 1);
                    _text[sizeof(_text) - 1] = '\0';
                    _dirty                    = true;
                }

                char _text[5] = {};
                bool _dirty   = false;
            };

            template<uint8_t row, uint8_t cc>
            class BreathCCMeter : public DisplayElement<15, row, 0, false>
            {
                public:
                BreathCCMeter()
                {
                    this->setText("%02d|-----------", static_cast<int>(cc));

                    // Show sax breath controller value (generated as a CONTROL_CHANGE event).
                    // We filter by componentIndex==0 to avoid catching generic analog components.
                    MidiDispatcher.listen(messaging::eventType_t::ANALOG,
                                          [this](const messaging::Event& event)
                                          {
                                              if (event.message != protocol::midi::messageType_t::CONTROL_CHANGE)
                                              {
                                                  return;
                                              }

                                              if (event.componentIndex != 0)
                                              {
                                                  return;
                                              }

                                              if (event.index != cc)
                                              {
                                                  return;
                                              }

                                              const uint8_t value = static_cast<uint8_t>(event.value);

                                              static constexpr uint8_t BAR_WIDTH = 11;
                                              uint8_t                 filled    = static_cast<uint8_t>((value * BAR_WIDTH + 63) / 127);

                                              if (filled > BAR_WIDTH)
                                              {
                                                  filled = BAR_WIDTH;
                                              }

                                              char temp[16] = {};
                                              snprintf(temp, sizeof(temp), "%02d|", static_cast<int>(cc));

                                              // temp[0..2] is now "NN|".
                                              for (uint8_t i = 0; i < BAR_WIDTH; i++)
                                              {
                                                  temp[3 + i] = (i < filled) ? '#' : '-';
                                              }

                                              temp[3 + BAR_WIDTH] = '\0';
                                              this->setText("%s", temp);
                                          });
                }
            };

            class PitchBendMeter : public DisplayElement<15, 3, 0, false>
            {
                public:
                PitchBendMeter()
                {
                    setNeutral();

                    auto handle = [this](const messaging::Event& event)
                    {
                        if (event.message != protocol::midi::messageType_t::PITCH_BEND)
                        {
                            return;
                        }

                        updateFromValue(static_cast<uint16_t>(event.value));
                    };

                    // Show most recent locally generated pitch bend (analog/buttons/encoders).
                    MidiDispatcher.listen(messaging::eventType_t::ANALOG, handle);
                    MidiDispatcher.listen(messaging::eventType_t::BUTTON, handle);
                    MidiDispatcher.listen(messaging::eventType_t::ENCODER, handle);
                }

                private:
                // Reserve the last LCD cell on the right as blank.
                // With COLUMN_PADDING=1 and MAX_COLUMNS=16, this element draws into columns 1..15.
                // Keeping maxLength=15 ensures we never draw past column 15.
                static constexpr uint8_t BAR_WIDTH = 11;

                void setNeutral()
                {
                    // "PB|" + 11 chars = 14; DisplayElement pads to 15 => last cell stays blank.
                    char temp[16] = {};
                    snprintf(temp, sizeof(temp), "PB|");

                    for (uint8_t i = 0; i < BAR_WIDTH; i++)
                    {
                        temp[3 + i] = '-';
                    }

                    temp[3 + ((BAR_WIDTH - 1) / 2)] = 'o';
                    temp[3 + BAR_WIDTH] = '\0';
                    setText("%s", temp);
                }

                void updateFromValue(uint16_t value)
                {
                    // 14-bit pitch bend (0..16383), center ~8192.
                    // Fallback: treat 0..127 as 7-bit if encountered.
                    uint8_t pos = 0;

                    if (value <= 127)
                    {
                        pos = static_cast<uint8_t>((static_cast<uint32_t>(value) * (BAR_WIDTH - 1)) / 127);
                    }
                    else
                    {
                        pos = static_cast<uint8_t>((static_cast<uint32_t>(value) * (BAR_WIDTH - 1)) / 16383);
                    }

                    if (pos >= BAR_WIDTH)
                    {
                        pos = BAR_WIDTH - 1;
                    }

                    const uint8_t center = (BAR_WIDTH - 1) / 2;

                    char temp[16] = {};
                    snprintf(temp, sizeof(temp), "PB|");

                    for (uint8_t i = 0; i < BAR_WIDTH; i++)
                    {
                        temp[3 + i] = '-';
                    }

                    // Always show the center reference.
                    temp[3 + center] = (pos == center) ? 'o' : '+';
                    temp[3 + pos]    = 'o';

                    temp[3 + BAR_WIDTH] = '\0';
                    setText("%s", temp);
                }
            };

            class SaxType : public DisplayElement<3, 2, 12, false>
            {
                public:
                SaxType()
                {
                    // Default placeholder.
                    setText("C  ");
                }

                void setFromTransposeSemis(int8_t semis)
                {
                    // Common sax transpositions (written -> concert):
                    // - Bb soprano: +2
                    // - Eb alto: +9
                    // - Bb tenor: +14 (octave + M2)
                    // - Eb bari: +21 (octave + M6)
                    // Prefer player-friendly instrument labels; transposition is shown separately.
                    switch (semis)
                    {
                    case 0:
                        setText("C  ");
                        break;

                    case 2:
                        setText("SOP");
                        break;

                    case 9:
                        setText("ALT");
                        break;

                    case 14:
                        setText("TEN");
                        break;

                    case 21:
                        setText("BAR");
                        break;

                    default:
                        setText("TRN");
                        break;
                    }
                }
            };

            class TransposeSemis : public DisplayElement<4, 3, 11, false>
            {
                public:
                TransposeSemis()
                {
                    setText("T+00");
                }

                void setSemis(int8_t semis)
                {
                    setText("T%+03d", semis);
                }
            };

            class InMessageIndicator : public DisplayElement<1, 0, 0, false>
            {
                public:
                InMessageIndicator()
                {
                    setText("%s", Strings::IN_EVENT_STRING);
                }
            };

            class OutMessageIndicator : public DisplayElement<1, 2, 0, false>
            {
                public:
                OutMessageIndicator()
                {
                    setText("%s", Strings::OUT_EVENT_STRING);
                }
            };

            Display&            _display;
            MIDIUpdater         _midiUpdater;
            MessageTypeIn       _messageTypeIn;
            MessageValueIn      _messageValueIn = MessageValueIn(_midiUpdater);
            MessageTypeOut      _messageTypeOut;
            MessageValueOut     _messageValueOut = MessageValueOut(_midiUpdater);
            Preset              _preset;
            BigNote             _bigNote;
            BreathCCMeter<1, 2>  _breathCc02Meter;
            BreathCCMeter<2, 11> _breathCc11Meter;
            PitchBendMeter       _pitchBendMeter;
            SaxType             _saxType;
            InMessageIndicator  _inMessageIndicator;
            OutMessageIndicator _outMessageIndicator;
            uint32_t            _lastRefreshTime      = 0;
            uint32_t            _messageRetentionTime = 0;
            bool                _messageDisplayedIn   = false;
            bool                _messageDisplayedOut  = false;
            elementsVec_t       _elements             = {
                // CC meters should draw last to override generic OUT message lines.
                &_breathCc02Meter,
                &_breathCc11Meter,
                &_pitchBendMeter,
            };

            void update();
            void setRetentionTime(uint32_t retentionTime);
        };

        friend class Elements;

        Hwa&                _hwa;
        Database&           _database;
        database::Admin&    _admin;
        u8x8_t              _u8x8;
        Elements            _elements                     = Elements(*this);
        uint8_t             _u8x8Buffer[U8X8_BUFFER_SIZE] = {};
        size_t              _u8x8Counter                  = 0;
        displayResolution_t _resolution                   = displayResolution_t::AMOUNT;
        bool                _initialized                  = false;
        bool                _startupInfoShown             = false;
        uint8_t             _selectedI2Caddress           = 0;
        size_t              _rows                         = 0;

        bool                   initU8X8(uint8_t i2cAddress, displayController_t controller, displayResolution_t resolution);
        bool                   deInit();
        void                   displayWelcomeMessage();
        uint8_t                getTextCenter(uint8_t textSize);
        std::optional<uint8_t> sysConfigGet(sys::Config::Section::i2c_t section, size_t index, uint16_t& value);
        std::optional<uint8_t> sysConfigSet(sys::Config::Section::i2c_t section, size_t index, uint16_t value);
    };
}    // namespace io::i2c::display