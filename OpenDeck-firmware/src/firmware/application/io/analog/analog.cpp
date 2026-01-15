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

#ifdef PROJECT_TARGET_SUPPORT_ADC

#include "analog.h"
#include "application/system/config.h"
#include "application/util/conversion/conversion.h"
#include "application/util/configurable/configurable.h"

#include "core/util/util.h"

using namespace io::analog;
using namespace protocol;

Analog::Analog(Hwa&      hwa,
               Filter&   filter,
               Database& database)
    : _hwa(hwa)
    , _filter(filter)
    , _database(database)
{
    MidiDispatcher.listen(messaging::eventType_t::SYSTEM,
                          [this](const messaging::Event& event)
                          {
                              switch (event.systemMessage)
                              {
                              case messaging::systemMessage_t::FORCE_IO_REFRESH:
                              {
                                  updateAll(true);
                              }
                              break;

                              default:
                                  break;
                              }
                          });

    ConfigHandler.registerConfig(
        sys::Config::block_t::ANALOG,
        // read
        [this](uint8_t section, size_t index, uint16_t& value)
        {
            return sysConfigGet(static_cast<sys::Config::Section::analog_t>(section), index, value);
        },

        // write
        [this](uint8_t section, size_t index, uint16_t value)
        {
            return sysConfigSet(static_cast<sys::Config::Section::analog_t>(section), index, value);
        });
}

bool Analog::init()
{
    for (size_t i = 0; i < Collection::SIZE(); i++)
    {
        reset(i);
    }

    return true;
}

void Analog::setPitchBendCenter(size_t index, uint16_t center)
{
    if (index >= Collection::SIZE(GROUP_ANALOG_INPUTS))
    {
        return;
    }

    _pitchBendCenter[index] = core::util::CONSTRAIN(center,
                                                   static_cast<uint16_t>(0),
                                                   static_cast<uint16_t>(midi::MAX_VALUE_14BIT));
}

void Analog::setPitchBendDeadzone(uint16_t deadzone)
{
    // Keep this sane; PB delta range per side is at most 8192.
    _pitchBendDeadzone = core::util::CONSTRAIN(deadzone, static_cast<uint16_t>(0), static_cast<uint16_t>(8192));
}

void Analog::updateSingle(size_t index, bool forceRefresh)
{
    if (index >= maxComponentUpdateIndex())
    {
        return;
    }

    if (!forceRefresh)
    {
        uint16_t value;

        if (!_hwa.value(index, value))
        {
            return;
        }

        processReading(index, value);
    }
    else
    {
        if (_database.read(database::Config::Section::analog_t::ENABLE, index))
        {
            Descriptor descriptor;
            fillDescriptor(index, descriptor);
            descriptor.event.forcedRefresh = true;

            descriptor.newValue = _lastValue[index];
            descriptor.oldValue = _lastValue[index];

            sendMessage(index, descriptor);
        }
    }
}

void Analog::updateAll(bool forceRefresh)
{
    // check values
    for (size_t i = 0; i < Collection::SIZE(GROUP_ANALOG_INPUTS); i++)
    {
        updateSingle(i, forceRefresh);
    }
}

size_t Analog::maxComponentUpdateIndex()
{
    return Collection::SIZE(GROUP_ANALOG_INPUTS);
}

void Analog::processReading(size_t index, uint16_t value)
{
    // don't process component if it's not enabled
    if (!_database.read(database::Config::Section::analog_t::ENABLE, index))
    {
        return;
    }

    Descriptor         analogDescriptor;
    Filter::Descriptor filterDescriptor;

    fillDescriptor(index, analogDescriptor);

    filterDescriptor.type        = analogDescriptor.type;
    filterDescriptor.value       = value;
    filterDescriptor.lowerOffset = analogDescriptor.lowerOffset;
    filterDescriptor.upperOffset = analogDescriptor.upperOffset;
    filterDescriptor.maxValue    = analogDescriptor.maxValue;

    if (!_filter.isFiltered(index, filterDescriptor))
    {
        return;
    }

    // assumption for now
    analogDescriptor.newValue = filterDescriptor.value;
    analogDescriptor.oldValue = _lastValue[index];

    bool send = false;

    switch (analogDescriptor.type)
    {
    case type_t::POTENTIOMETER_CONTROL_CHANGE:
    case type_t::POTENTIOMETER_NOTE:
    case type_t::NRPN_7BIT:
    case type_t::NRPN_14BIT:
    case type_t::PITCH_BEND:
    case type_t::CONTROL_CHANGE_14BIT:
    {
        if (checkPotentiometerValue(index, analogDescriptor))
        {
            send = true;
        }
    }
    break;

    case type_t::FSR:
    {
        if (checkFSRvalue(index, analogDescriptor))
        {
            send = true;
        }
    }
    break;

    case type_t::BUTTON:
    {
        send = true;
    }
    break;

    case type_t::RESERVED:
    {
        // Reserved inputs are used for internal features (no MIDI output),
        // but we still want filtering + scaled value updates in _lastValue.
        if (checkPotentiometerValue(index, analogDescriptor))
        {
            _lastValue[index] = analogDescriptor.newValue;
        }

        return;
    }
    break;

    default:
        break;
    }

    if (send)
    {
        sendMessage(index, analogDescriptor);
        _lastValue[index] = analogDescriptor.newValue;
    }
}

uint16_t Analog::value(size_t index) const
{
    if (index >= Collection::SIZE())
    {
        return 0xFFFF;
    }

    return _lastValue[index];
}

bool Analog::checkPotentiometerValue(size_t index, Descriptor& descriptor)
{
    switch (descriptor.type)
    {
    case type_t::NRPN_14BIT:
    case type_t::PITCH_BEND:
    case type_t::CONTROL_CHANGE_14BIT:
        break;

    default:
    {
        // use 7-bit MIDI ID and limits
        auto splitIndex        = util::Conversion::Split14Bit(descriptor.event.index);
        descriptor.event.index = splitIndex.low();

        auto splitLowerLimit  = util::Conversion::Split14Bit(descriptor.lowerLimit);
        descriptor.lowerLimit = splitLowerLimit.low();

        auto splitUpperLimit  = util::Conversion::Split14Bit(descriptor.upperLimit);
        descriptor.upperLimit = splitUpperLimit.low();
    }
    break;
    }

    if (descriptor.newValue > descriptor.maxValue)
    {
        return false;
    }

    auto scale = [&](uint16_t value)
    {
        uint32_t scaled = 0;

        if (descriptor.lowerLimit > descriptor.upperLimit)
        {
            scaled = core::util::MAP_RANGE(static_cast<uint32_t>(value),
                                           static_cast<uint32_t>(0),
                                           static_cast<uint32_t>(descriptor.maxValue),
                                           static_cast<uint32_t>(descriptor.upperLimit),
                                           static_cast<uint32_t>(descriptor.lowerLimit));

            if (!descriptor.inverted)
            {
                scaled = descriptor.upperLimit - (scaled - descriptor.lowerLimit);
            }
        }
        else
        {
            scaled = core::util::MAP_RANGE(static_cast<uint32_t>(value),
                                           static_cast<uint32_t>(0),
                                           static_cast<uint32_t>(descriptor.maxValue),
                                           static_cast<uint32_t>(descriptor.lowerLimit),
                                           static_cast<uint32_t>(descriptor.upperLimit));

            if (descriptor.inverted)
            {
                scaled = descriptor.upperLimit - (scaled - descriptor.lowerLimit);
            }
        }

        return scaled;
    };

    auto scaled = scale(descriptor.newValue);

    if (scaled == descriptor.oldValue)
    {
        return false;
    }

    descriptor.newValue = scaled;

    return true;
}

bool Analog::checkFSRvalue(size_t index, Descriptor& descriptor)
{
    // don't allow touchscreen components to be processed as FSR
    if (index >= Collection::SIZE(GROUP_ANALOG_INPUTS))
    {
        return false;
    }

    if (descriptor.newValue > 0)
    {
        if (!fsrState(index))
        {
            // sensor is really pressed
            setFSRstate(index, true);
            return true;
        }
    }
    else
    {
        if (fsrState(index))
        {
            setFSRstate(index, false);
            return true;
        }
    }

    return false;
}

void Analog::sendMessage(size_t index, Descriptor& descriptor)
{
    auto eventType         = messaging::eventType_t::ANALOG;
    descriptor.event.value = descriptor.newValue;

    auto send = [&]()
    {
        MidiDispatcher.notify(eventType, descriptor.event);
    };

    switch (descriptor.type)
    {
    case type_t::POTENTIOMETER_CONTROL_CHANGE:
    case type_t::POTENTIOMETER_NOTE:
    case type_t::PITCH_BEND:
    case type_t::NRPN_7BIT:
    case type_t::NRPN_14BIT:
    {
        if (descriptor.type == type_t::PITCH_BEND)
        {
            // Optional scaling for pitch bend amount.
            // Dedicated sax targets reserve analog index 2 as a "pitch amount" pot.
            // Value range is 0..127, where 127 means full scale.
            static constexpr size_t   PITCH_AMOUNT_ANALOG_INDEX = 2;
            static constexpr uint16_t PB_CENTER_DEFAULT          = 8192;

            const uint16_t pbCenter = (_pitchBendCenter[index] <= midi::MAX_VALUE_14BIT)
                                          ? _pitchBendCenter[index]
                                          : PB_CENTER_DEFAULT;

            if (index != PITCH_AMOUNT_ANALOG_INDEX)
            {
                auto amount = _lastValue[PITCH_AMOUNT_ANALOG_INDEX];

                if ((amount != 0xFFFF) && (amount <= 127) && (amount != 127))
                {
                    const int32_t delta       = static_cast<int32_t>(descriptor.event.value) - static_cast<int32_t>(pbCenter);
                    const int32_t scaledDelta = (delta * static_cast<int32_t>(amount)) / 127;
                    descriptor.event.value    = static_cast<uint16_t>(static_cast<int32_t>(pbCenter) + scaledDelta);
                }
            }

            // Pitch bend shaping: deadzone around center + cubic curve.
            // This makes small fluctuations near center much less sensitive, while
            // preserving full-scale bend at the extremes.
            static constexpr uint32_t Q15                             = 32767;
            static constexpr uint64_t Q15_CUBE                        = static_cast<uint64_t>(Q15) * Q15 * Q15;

            const int32_t value = static_cast<int32_t>(descriptor.event.value);

            // MIDI PB is 14-bit: 0..16383.
            // Use captured pbCenter to define the neutral point, but always output
            // PB_CENTER_DEFAULT as "no bend".
            const int32_t delta = value - static_cast<int32_t>(pbCenter);

            if (delta != 0)
            {
                const int32_t sign   = (delta < 0) ? -1 : 1;
                const int32_t maxAbs = (sign < 0)
                                           ? static_cast<int32_t>(pbCenter)
                                           : static_cast<int32_t>(midi::MAX_VALUE_14BIT) - static_cast<int32_t>(pbCenter);

                    const int32_t deadzone = core::util::CONSTRAIN(static_cast<int32_t>(_pitchBendDeadzone),
                                                                  static_cast<int32_t>(0),
                                                                  maxAbs);
                const int32_t absDeltaRaw = (delta < 0) ? -delta : delta;
                const int32_t absDelta    = core::util::CONSTRAIN(absDeltaRaw, static_cast<int32_t>(0), maxAbs);

                int32_t shapedDelta = 0;

                    if (absDelta > deadzone)
                {
                        const int32_t absNoDZ = absDelta - deadzone;
                        const int32_t denom   = maxAbs - deadzone;

                    // Normalize to Q15: n in [0..Q15].
                    uint32_t n = 0;

                    if (denom > 0)
                    {
                        n = static_cast<uint32_t>((static_cast<uint64_t>(absNoDZ) * Q15 + static_cast<uint64_t>(denom) / 2) /
                                                  static_cast<uint64_t>(denom));
                    }

                    if (n > Q15)
                    {
                        n = Q15;
                    }

                    // Cubic curve: y = (n/Q15)^3, scaled back to full range.
                    const uint64_t n3 = static_cast<uint64_t>(n) * n * n;
                    const uint32_t outAbs = static_cast<uint32_t>((n3 * static_cast<uint64_t>(maxAbs) + Q15_CUBE / 2) / Q15_CUBE);

                    shapedDelta = static_cast<int32_t>(outAbs) * sign;
                }

                const int32_t outValue = static_cast<int32_t>(PB_CENTER_DEFAULT) + shapedDelta;
                descriptor.event.value = static_cast<uint16_t>(core::util::CONSTRAIN(outValue,
                                                                                    static_cast<int32_t>(0),
                                                                                    static_cast<int32_t>(midi::MAX_VALUE_14BIT)));
            }
            else
            {
                descriptor.event.value = PB_CENTER_DEFAULT;
            }
        }

        send();
    }
    break;

    case type_t::FSR:
    {
        if (!descriptor.newValue)
        {
            descriptor.event.message = midi::messageType_t::NOTE_OFF;
        }

        send();
    }
    break;

    case type_t::BUTTON:
    {
        eventType = messaging::eventType_t::ANALOG_BUTTON;
        send();
    }
    break;

    case type_t::CONTROL_CHANGE_14BIT:
    {
        if (descriptor.event.index >= 96)
        {
            // not allowed
            return;
        }

        send();
    }
    break;

    default:
        break;
    }
}

void Analog::reset(size_t index)
{
    setFSRstate(index, false);
    _filter.reset(index);
    _lastValue[index] = 0xFFFF;

    static constexpr uint16_t PB_CENTER_DEFAULT = 8192;
    _pitchBendCenter[index]                     = PB_CENTER_DEFAULT;
}

void Analog::setFSRstate(size_t index, bool state)
{
    uint8_t arrayIndex  = index / 8;
    uint8_t analogIndex = index - 8 * arrayIndex;

    core::util::BIT_WRITE(_fsrPressed[arrayIndex], analogIndex, state);
}

bool Analog::fsrState(size_t index)
{
    uint8_t arrayIndex  = index / 8;
    uint8_t analogIndex = index - 8 * arrayIndex;

    return core::util::BIT_READ(_fsrPressed[arrayIndex], analogIndex);
}

void Analog::fillDescriptor(size_t index, Descriptor& descriptor)
{
    descriptor.type                 = static_cast<type_t>(_database.read(database::Config::Section::analog_t::TYPE, index));
    descriptor.inverted             = _database.read(database::Config::Section::analog_t::INVERT, index);
    descriptor.lowerLimit           = _database.read(database::Config::Section::analog_t::LOWER_LIMIT, index);
    descriptor.upperLimit           = _database.read(database::Config::Section::analog_t::UPPER_LIMIT, index);
    descriptor.lowerOffset          = _database.read(database::Config::Section::analog_t::LOWER_OFFSET, index);
    descriptor.upperOffset          = _database.read(database::Config::Section::analog_t::UPPER_OFFSET, index);
    descriptor.event.componentIndex = index;
    descriptor.event.channel        = _database.read(database::Config::Section::analog_t::CHANNEL, index);
    descriptor.event.index          = _database.read(database::Config::Section::analog_t::MIDI_ID, index);
    descriptor.event.message        = INTERNAL_MSG_TO_MIDI_TYPE[static_cast<uint8_t>(descriptor.type)];

    switch (descriptor.type)
    {
    case type_t::NRPN_14BIT:
    case type_t::PITCH_BEND:
    case type_t::CONTROL_CHANGE_14BIT:
    {
        descriptor.maxValue = midi::MAX_VALUE_14BIT;
    }
    break;

    default:
    {
        descriptor.maxValue = midi::MAX_VALUE_7BIT;
    }
    break;
    }
}

std::optional<uint8_t> Analog::sysConfigGet(sys::Config::Section::analog_t section, size_t index, uint16_t& value)
{
    uint32_t readValue;

    auto result = _database.read(util::Conversion::SYS_2_DB_SECTION(section), index, readValue)
                      ? sys::Config::Status::ACK
                      : sys::Config::Status::ERROR_READ;

    switch (section)
    {
    case sys::Config::Section::analog_t::RESERVED_1:
    case sys::Config::Section::analog_t::RESERVED_2:
    case sys::Config::Section::analog_t::RESERVED_3:
        return sys::Config::Status::ERROR_NOT_SUPPORTED;

    default:
        break;
    }

    value = readValue;

    return result;
}

std::optional<uint8_t> Analog::sysConfigSet(sys::Config::Section::analog_t section, size_t index, uint16_t value)
{
    switch (section)
    {
    case sys::Config::Section::analog_t::RESERVED_1:
    case sys::Config::Section::analog_t::RESERVED_2:
    case sys::Config::Section::analog_t::RESERVED_3:
        return sys::Config::Status::ERROR_NOT_SUPPORTED;

    case sys::Config::Section::analog_t::TYPE:
    {
        reset(index);

        // If this input is switched to PITCH_BEND at runtime (via UI/config),
        // apply the stored sax PB center immediately so the neutral point is
        // consistent without requiring a reboot.
        if (static_cast<type_t>(value) == type_t::PITCH_BEND)
        {
            static constexpr size_t   SAX_PB_CENTER_SETTING_INDEX = 13;
            static constexpr uint16_t PB_CENTER_DEFAULT           = 8192;

            uint32_t storedCenter = _database.readSystem(SAX_PB_CENTER_SETTING_INDEX);

            if (storedCenter > midi::MAX_VALUE_14BIT)
            {
                storedCenter = PB_CENTER_DEFAULT;
            }

            setPitchBendCenter(index, static_cast<uint16_t>(storedCenter));
        }
    }
    break;

    default:
        break;
    }

    return _database.update(util::Conversion::SYS_2_DB_SECTION(section), index, value)
               ? sys::Config::Status::ACK
               : sys::Config::Status::ERROR_WRITE;
}

#endif