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

#ifdef PROJECT_TARGET_SUPPORT_DISPLAY

#include "display.h"

#include "core/mcu.h"
#include "board/board.h"

using namespace io::i2c::display;
using namespace protocol;

void Display::Elements::update()
{
    if ((core::mcu::timing::ms() - _lastRefreshTime) < REFRESH_TIME)
    {
        return;    // we don't need to update lcd in real time
    }

    const auto nowMs = core::mcu::timing::ms();

#ifdef PROJECT_TARGET_SUPPORT_USB
    const bool usbConnected = board::usb::isUsbConnected();
#else
    const bool usbConnected = false;
#endif

    // Large emphasized note display (2x2).
    // Always takes priority over other row-0 text; we redraw it last if anything overlaps.
    static constexpr uint8_t BIG_NOTE_X_START = Display::COLUMN_PADDING;
    static constexpr uint8_t BIG_NOTE_X_END   = Display::COLUMN_PADDING + 7;    // 4 chars * 2 columns each
    bool                     redrawBigNote    = _bigNote.dirty();

    int8_t transposeSemisForTopBar = 0;

    // Sax transpose status (custom system setting index 11):
    // stored as 0..48 where 24 == 0 semitones.
    {
        static constexpr size_t  SAX_TRANSPOSE_SETTING_INDEX = 11;
        static constexpr int16_t ENCODED_CENTER              = 24;
        static constexpr uint16_t VALUE_MASK                 = 0x7FFF;

        const uint16_t encoded = static_cast<uint16_t>(
            _display._admin.read(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                 SAX_TRANSPOSE_SETTING_INDEX) & VALUE_MASK);
        int16_t        semis   = static_cast<int16_t>(encoded) - ENCODED_CENTER;

        if (semis < -24)
        {
            semis = -24;
        }
        else if (semis > 24)
        {
            semis = 24;
        }

        _saxType.setFromTransposeSemis(static_cast<int8_t>(semis));
        transposeSemisForTopBar = static_cast<int8_t>(semis);
    }

    for (size_t i = 0; i < _elements.size(); i++)
    {
        auto element = _elements.at(i);

        if (_messageRetentionTime)
        {
            if (element->USE_RETENTION())
            {
                if (strlen(element->text()))
                {
                    if (((core::mcu::timing::ms() - element->lastUpdateTime()) > _messageRetentionTime))
                    {
                        element->setText("");
                    }
                }
            }
        }

        auto change = element->change();

        if (change)
        {
            for (size_t index = 0; index < element->MAX_LENGTH(); index++)
            {
                if (core::util::BIT_READ(change, index))
                {
                    // If anything updates in the area where the big note is rendered,
                    // redraw the big note afterwards to keep it visible.
                    const uint8_t drawX = static_cast<uint8_t>(element->COLUMN() + index + Display::COLUMN_PADDING);

                    if ((element->ROW() == 0) && (drawX >= BIG_NOTE_X_START) && (drawX <= BIG_NOTE_X_END))
                    {
                        redrawBigNote = true;
                    }

                    u8x8_DrawGlyph(&_display._u8x8,
                                   drawX,
                                   Display::ROW_MAP[_display._resolution][element->ROW()],
                                   element->text()[index]);
                }
            }

            element->clearChange();
        }
    }

    if (redrawBigNote)
    {
        // Uses physical rows 0/1 intentionally (ROW_MAP skips some rows for spacing).
        u8x8_Draw2x2String(&_display._u8x8, Display::COLUMN_PADDING, 0, _bigNote.text());
        _bigNote.clearDirty();
    }

    // Small USB connection indicator next to the big note.
    // Draw this last so other elements can't overwrite it.
    {
        // Move 2 columns left vs the default position.
        // Safe because the big note uses 4 chars and the 4th one is always a space (note name is max 2 chars + octave 1).
        static constexpr uint8_t USB_ICON_X = Display::COLUMN_PADDING + 5;
        u8x8_DrawString(&_display._u8x8, USB_ICON_X, 0, usbConnected ? "USB" : "   ");

        // Always-on power indicator (circle-with-dot approximation).
        // Placed right next to the USB indicator.
        static constexpr uint8_t POWER_ICON_X = Display::COLUMN_PADDING + 8;
        u8x8_DrawGlyph(&_display._u8x8, POWER_ICON_X, 0, 'o');
    }

    // Always show sax transpose next to USB indicator (top row).
    {
        // Move 2 columns left vs the default position.
        static constexpr uint8_t TRANSPOSE_X = Display::COLUMN_PADDING + 10;
        char                     temp[5]    = {};
        snprintf(temp, sizeof(temp), "T%+03d", static_cast<int>(transposeSemisForTopBar));
        u8x8_DrawString(&_display._u8x8, TRANSPOSE_X, 0, temp);
    }

    _lastRefreshTime = nowMs;
}

/// Sets new message retention time.
/// param [in]: retentionTime New retention time in milliseconds.
void Display::Elements::setRetentionTime(uint32_t retentionTime)
{
    _messageRetentionTime = retentionTime;

    // clear out elements immediately on change
    for (size_t i = 0; i < _elements.size(); i++)
    {
        auto element = _elements.at(i);

        if (_messageRetentionTime)
        {
            if (element->USE_RETENTION())
            {
                if (strlen(element->text()))
                {
                    element->setText("");
                }
            }
        }
    }
}

void Display::Elements::MIDIUpdater::useAlternateNote(bool state)
{
    _useAlternateNote = state;
}

void Display::Elements::MIDIUpdater::updateMIDIValue(DisplayTextControl& element, const messaging::Event& event)
{
    switch (event.message)
    {
    case midi::messageType_t::NOTE_OFF:
    case midi::messageType_t::NOTE_ON:
    {
        if (!_useAlternateNote)
        {
            element.setText("CH%d %d v%d", event.channel, event.index, event.value);
        }
        else
        {
            element.setText("CH%d %s%d v%d",
                            event.channel,
                            Strings::NOTE(midi::NOTE_TO_TONIC(event.index)),
                            midi::NOTE_TO_OCTAVE(event.value),
                            event.value);
        }
    }
    break;

    case midi::messageType_t::PROGRAM_CHANGE:
    {
        element.setText("CH%d %d", event.channel, event.index);
    }
    break;

    case midi::messageType_t::CONTROL_CHANGE:
    case midi::messageType_t::CONTROL_CHANGE_14BIT:
    case midi::messageType_t::NRPN_7BIT:
    case midi::messageType_t::NRPN_14BIT:
    {
        element.setText("CH%d %d %d", event.channel, event.index, event.value);
    }
    break;

    case midi::messageType_t::MMC_PLAY:
    case midi::messageType_t::MMC_STOP:
    case midi::messageType_t::MMC_RECORD_START:
    case midi::messageType_t::MMC_RECORD_STOP:
    case midi::messageType_t::MMC_PAUSE:
    {
        element.setText("CH%d", event.index);
    }
    break;

    case midi::messageType_t::SYS_REAL_TIME_CLOCK:
    case midi::messageType_t::SYS_REAL_TIME_START:
    case midi::messageType_t::SYS_REAL_TIME_CONTINUE:
    case midi::messageType_t::SYS_REAL_TIME_STOP:
    case midi::messageType_t::SYS_REAL_TIME_ACTIVE_SENSING:
    case midi::messageType_t::SYS_REAL_TIME_SYSTEM_RESET:
    case midi::messageType_t::SYS_EX:
    default:
        break;
    }
}

#endif