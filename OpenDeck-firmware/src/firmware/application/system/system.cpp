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

#include "system.h"
#include "application/messaging/messaging.h"
#include "application/util/configurable/configurable.h"
#include "application/util/conversion/conversion.h"
#include "application/global/midi_program.h"
#include "application/io/analog/analog.h"
#include "application/io/analog/common.h"
#include "application/io/buttons/buttons.h"
#include "application/protocol/midi/common.h"
#include "bootloader/fw_selector/fw_selector.h"

#include "core/mcu.h"
#include "core/util/util.h"

using namespace io;
using namespace sys;
using namespace protocol;

System::System(Hwa&        hwa,
               Components& components)
    : _hwa(hwa)
    , _components(components)
    , _databaseHandlers(*this)
    , _sysExDataHandler(*this)
    , _sysExConf(
          _sysExDataHandler,
          SYS_EX_MID)
{
    _analog = static_cast<::io::analog::Analog*>(_components.io().at(static_cast<size_t>(ioComponent_t::ANALOG)));
    _buttons = static_cast<::io::buttons::Buttons*>(_components.io().at(static_cast<size_t>(ioComponent_t::BUTTONS)));

    MidiDispatcher.listen(messaging::eventType_t::MIDI_IN,
                          [this](const messaging::Event& event)
                          {
                              switch (event.message)
                              {
                              case midi::messageType_t::PROGRAM_CHANGE:
                              {
                                  if (_components.database().read(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                                                  Config::systemSetting_t::ENABLE_PRESET_CHANGE_WITH_PROGRAM_CHANGE_IN))
                                  {
                                      _components.database().setPreset(event.index);
                                  }
                              }
                              break;

                              case midi::messageType_t::SYS_EX:
                              {
                                  _sysExConf.handleMessage(event.sysEx, event.sysExLength);

                                  if (_backupRestoreState == backupRestoreState_t::BACKUP)
                                  {
                                      backup();
                                  }
                              }
                              break;

                              default:
                                  break;
                              }
                          });

    MidiDispatcher.listen(messaging::eventType_t::SYSTEM,
                          [this](const messaging::Event& event)
                          {
                              switch (event.systemMessage)
                              {
                              case messaging::systemMessage_t::PRESET_CHANGED:
                              {
                                  ensureSaxAnalogConfigured();
                              }
                              break;

                              case messaging::systemMessage_t::SAX_TRANSPOSE_INC_REQ:
                              case messaging::systemMessage_t::SAX_TRANSPOSE_DEC_REQ:
                              {
                                  // Custom system setting index 11: sax transpose raw value 0..48 (= -24..+24 semis).
                                  static constexpr size_t  SAX_TRANSPOSE_SETTING_INDEX = 11;
                                  static constexpr uint16_t SAX_TRANSPOSE_INIT_FLAG    = 0x8000;
                                  static constexpr uint16_t SAX_TRANSPOSE_VALUE_MASK   = 0x7FFF;
                                  static constexpr uint16_t RAW_MIN                    = 0;
                                  static constexpr uint16_t RAW_MAX                    = 48;

                                  uint16_t steps = event.value;
                                  if (steps == 0)
                                  {
                                      steps = 1;
                                  }

                                  const uint16_t stored = _components.database().read(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                                                                     SAX_TRANSPOSE_SETTING_INDEX);
                                  uint16_t current       = static_cast<uint16_t>(stored & SAX_TRANSPOSE_VALUE_MASK);
                                  current                = core::util::CONSTRAIN(current, RAW_MIN, RAW_MAX);

                                  uint16_t updated = current;

                                  if (event.systemMessage == messaging::systemMessage_t::SAX_TRANSPOSE_INC_REQ)
                                  {
                                      updated = static_cast<uint16_t>(core::util::CONSTRAIN(static_cast<uint16_t>(current + steps), RAW_MIN, RAW_MAX));
                                  }
                                  else
                                  {
                                      updated = static_cast<uint16_t>(core::util::CONSTRAIN(static_cast<int32_t>(current) - static_cast<int32_t>(steps),
                                                                                           static_cast<int32_t>(RAW_MIN),
                                                                                           static_cast<int32_t>(RAW_MAX)));
                                  }

                                  if (updated != current)
                                  {
                                      _components.database().update(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                                                    SAX_TRANSPOSE_SETTING_INDEX,
                                                                    static_cast<uint16_t>(SAX_TRANSPOSE_INIT_FLAG | updated));
                                  }

                                  // Broadcast (updated) value so IO components can apply it immediately.
                                  messaging::Event notifyEvent = {};
                                  notifyEvent.systemMessage    = messaging::systemMessage_t::SAX_TRANSPOSE_CHANGED;
                                  notifyEvent.value            = updated;
                                  MidiDispatcher.notify(messaging::eventType_t::SYSTEM, notifyEvent);
                              }
                              break;

                              case messaging::systemMessage_t::SAX_TRANSPOSE_SET_REQ:
                              {
                                  // Custom system setting index 11: sax transpose raw value 0..48 (= -24..+24 semis).
                                  static constexpr size_t  SAX_TRANSPOSE_SETTING_INDEX = 11;
                                  static constexpr uint16_t SAX_TRANSPOSE_INIT_FLAG    = 0x8000;
                                  static constexpr uint16_t SAX_TRANSPOSE_VALUE_MASK   = 0x7FFF;
                                  static constexpr uint16_t RAW_MIN                    = 0;
                                  static constexpr uint16_t RAW_MAX                    = 48;

                                  const uint16_t requested = core::util::CONSTRAIN(static_cast<uint16_t>(event.value), RAW_MIN, RAW_MAX);
                                  const uint16_t stored = _components.database().read(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                                                                    SAX_TRANSPOSE_SETTING_INDEX);
                                  uint16_t current       = static_cast<uint16_t>(stored & SAX_TRANSPOSE_VALUE_MASK);
                                  current                = core::util::CONSTRAIN(current, RAW_MIN, RAW_MAX);

                                  if (requested != current)
                                  {
                                      _components.database().update(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                                                    SAX_TRANSPOSE_SETTING_INDEX,
                                                                    static_cast<uint16_t>(SAX_TRANSPOSE_INIT_FLAG | requested));
                                  }

                                  messaging::Event notifyEvent = {};
                                  notifyEvent.systemMessage    = messaging::systemMessage_t::SAX_TRANSPOSE_CHANGED;
                                  notifyEvent.value            = requested;
                                  MidiDispatcher.notify(messaging::eventType_t::SYSTEM, notifyEvent);
                              }
                              break;

                              case messaging::systemMessage_t::SAX_PB_CENTER_CAPTURE_REQ:
                              {
                                  if (_analog == nullptr)
                                  {
                                      break;
                                  }

                                  static constexpr size_t  SAX_PB_CENTER_SETTING_INDEX = 13;
                                  static constexpr uint16_t PB_CENTER_DEFAULT          = 8192;

                                  // Use the first PITCH_BEND analog input as the calibration source.
                                  size_t pbIndex = ::io::analog::Collection::SIZE(::io::analog::GROUP_ANALOG_INPUTS);

                                  for (size_t i = 0; i < ::io::analog::Collection::SIZE(::io::analog::GROUP_ANALOG_INPUTS); i++)
                                  {
                                      const auto typeRaw = _components.database().read(database::Config::Section::analog_t::TYPE, i);
                                      if (static_cast<::io::analog::type_t>(typeRaw) == ::io::analog::type_t::PITCH_BEND)
                                      {
                                          pbIndex = i;
                                          break;
                                      }
                                  }

                                  if (pbIndex >= ::io::analog::Collection::SIZE(::io::analog::GROUP_ANALOG_INPUTS))
                                  {
                                      break;
                                  }

                                  const uint16_t rawCenter = _analog->value(pbIndex);
                                  if (rawCenter == 0xFFFF)
                                  {
                                      break;
                                  }

                                  const uint16_t storedCenter = (rawCenter <= midi::MAX_VALUE_14BIT) ? rawCenter : PB_CENTER_DEFAULT;

                                  _components.database().update(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                                                SAX_PB_CENTER_SETTING_INDEX,
                                                                storedCenter);

                                  // Apply to all PITCH_BEND analog inputs.
                                  for (size_t i = 0; i < ::io::analog::Collection::SIZE(::io::analog::GROUP_ANALOG_INPUTS); i++)
                                  {
                                      const auto typeRaw = _components.database().read(database::Config::Section::analog_t::TYPE, i);
                                      if (static_cast<::io::analog::type_t>(typeRaw) == ::io::analog::type_t::PITCH_BEND)
                                      {
                                          _analog->setPitchBendCenter(i, storedCenter);
                                      }
                                  }
                              }
                              break;

                              case messaging::systemMessage_t::PRESET_CHANGE_INC_REQ:
                              {
                                  _components.database().setPreset(_components.database().getPreset() + 1);
                              }
                              break;

                              case messaging::systemMessage_t::PRESET_CHANGE_DEC_REQ:
                              {
                                  _components.database().setPreset(_components.database().getPreset() - 1);
                              }
                              break;

                              case messaging::systemMessage_t::PRESET_CHANGE_DIRECT_REQ:
                              {
                                  _components.database().setPreset(event.index);
                              }
                              break;

                              default:
                                  break;
                              }
                          });

    ConfigHandler.registerConfig(
        sys::Config::block_t::GLOBAL,
        // read
        [this](uint8_t section, size_t index, uint16_t& value)
        {
            return sysConfigGet(static_cast<sys::Config::Section::global_t>(section), index, value);
        },

        // write
        [this](uint8_t section, size_t index, uint16_t value)
        {
            return sysConfigSet(static_cast<sys::Config::Section::global_t>(section), index, value);
        });
}

bool System::init()
{
    _scheduler.init();

    _cInfo.registerHandler([this](size_t group, size_t index)
                           {
                               if (_sysExConf.isConfigurationEnabled())
                               {
                                   uint16_t cInfoMessage[] = {
                                       SYSEX_CM_COMPONENT_ID,
                                       static_cast<uint16_t>(group),
                                       0,
                                       0
                                   };

                                   auto split = util::Conversion::Split14Bit(index);

                                   cInfoMessage[2] = split.high();
                                   cInfoMessage[3] = split.low();

                                   _sysExConf.sendCustomMessage(cInfoMessage, 4);
                               }
                           });

    _hwa.registerOnUSBconnectionHandler([this]()
                                        {
                                            _scheduler.registerTask({ SCHEDULED_TASK_FORCED_REFRESH,
                                                                      USB_CHANGE_FORCED_REFRESH_DELAY,
                                                                      [this]()
                                                                      {
                                                                          forceComponentRefresh();
                                                                      } });
                                        });

    if (!_hwa.init())
    {
        return false;
    }

    if (!_components.database().init(_databaseHandlers))
    {
        return false;
    }

    for (size_t i = 0; i < _components.io().size(); i++)
    {
        auto component = _components.io().at(i);

        if (component != nullptr)
        {
            component->init();
        }
    }

    ensureSaxAnalogConfigured();

    // Sync sax transpose (custom system setting index 11) to interested components.
    {
        static constexpr size_t  SAX_TRANSPOSE_SETTING_INDEX = 11;
        static constexpr uint16_t SAX_TRANSPOSE_INIT_FLAG    = 0x8000;
        static constexpr uint16_t SAX_TRANSPOSE_VALUE_MASK   = 0x7FFF;
        static constexpr uint16_t RAW_MIN                    = 0;
        static constexpr uint16_t RAW_MAX                    = 48;

        // One-time migration/defaulting: mark setting as initialized (MSB).
        // If legacy DB left this at 0 without initialization, set to 0 semis (raw 24).
        const uint16_t stored = _components.database().read(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                                           SAX_TRANSPOSE_SETTING_INDEX);

        if ((stored & SAX_TRANSPOSE_INIT_FLAG) == 0)
        {
            const uint16_t legacyValue = static_cast<uint16_t>(stored & SAX_TRANSPOSE_VALUE_MASK);
            const uint16_t initValue   = (legacyValue == 0) ? static_cast<uint16_t>(24) : legacyValue;

            _components.database().update(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                          SAX_TRANSPOSE_SETTING_INDEX,
                                          static_cast<uint16_t>(SAX_TRANSPOSE_INIT_FLAG | core::util::CONSTRAIN(initValue, RAW_MIN, RAW_MAX)));
        }

        const uint16_t storedAfter = _components.database().read(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                                                SAX_TRANSPOSE_SETTING_INDEX);
        uint16_t       current     = static_cast<uint16_t>(storedAfter & SAX_TRANSPOSE_VALUE_MASK);
        current                    = core::util::CONSTRAIN(current, RAW_MIN, RAW_MAX);

        messaging::Event notifyEvent = {};
        notifyEvent.systemMessage    = messaging::systemMessage_t::SAX_TRANSPOSE_CHANGED;
        notifyEvent.value            = current;
        MidiDispatcher.notify(messaging::eventType_t::SYSTEM, notifyEvent);
    }

    // Apply stored pitch bend center (player calibration) on startup.
    {
        if (_analog != nullptr)
        {
            static constexpr size_t  SAX_PB_CENTER_SETTING_INDEX = 13;
            static constexpr uint16_t PB_CENTER_DEFAULT          = 8192;

            uint16_t storedCenter = _components.database().read(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                                               SAX_PB_CENTER_SETTING_INDEX);
            if (storedCenter > midi::MAX_VALUE_14BIT)
            {
                storedCenter = PB_CENTER_DEFAULT;
            }

            for (size_t i = 0; i < ::io::analog::Collection::SIZE(::io::analog::GROUP_ANALOG_INPUTS); i++)
            {
                const auto typeRaw = _components.database().read(database::Config::Section::analog_t::TYPE, i);
                if (static_cast<::io::analog::type_t>(typeRaw) == ::io::analog::type_t::PITCH_BEND)
                {
                    _analog->setPitchBendCenter(i, storedCenter);
                }
            }
        }
    }

    // Apply stored pitch bend deadzone (center sensitivity) on startup.
    {
        if (_analog != nullptr)
        {
            static constexpr size_t  SAX_PB_DEADZONE_SETTING_INDEX = 12;
            const uint16_t storedDeadzone = _components.database().read(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                                                        SAX_PB_DEADZONE_SETTING_INDEX);
            _analog->setPitchBendDeadzone(storedDeadzone);
        }
    }

    _sysExConf.setLayout(_layout.layout());
    _sysExConf.setupCustomRequests(_layout.customRequests());

    for (size_t i = 0; i < _components.protocol().size(); i++)
    {
        auto component = _components.protocol().at(i);

        if (component != nullptr)
        {
            component->init();
        }
    }

    // on startup, indicate current program for all channels
    for (int i = 1; i <= 16; i++)
    {
        messaging::Event event = {};
        event.componentIndex   = 0;
        event.channel          = i;
        event.index            = MidiProgram.program(i);
        event.value            = 0;
        event.message          = midi::messageType_t::PROGRAM_CHANGE;

        MidiDispatcher.notify(messaging::eventType_t::PROGRAM, event);
    }

    return true;
}

// Return the last processed IO component:
// components aren't checked all at once, but
// rather a single one for each run() call. This is
// done to reduce the amount of spent time inside checkComponents.
ioComponent_t System::run()
{
    _hwa.update();
    auto retVal = checkComponents();
    checkProtocols();
    updateSax();
    _scheduler.update();

    return retVal;
}

uint8_t System::resolvedMidiChannel() const
{
    const uint8_t globalChannel = _components.database().read(database::Config::Section::global_t::MIDI_SETTINGS,
                                                              midi::setting_t::GLOBAL_CHANNEL);
    const uint8_t useGlobal     = _components.database().read(database::Config::Section::global_t::MIDI_SETTINGS,
                                                              midi::setting_t::USE_GLOBAL_CHANNEL);

    uint8_t channel = useGlobal ? globalChannel : 1;

    if ((channel == 0) || (channel > 16) || (channel == midi::OMNI_CHANNEL))
    {
        channel = 1;
    }

    return channel;
}

void System::ensureSaxAnalogConfigured()
{
    // Custom system settings live in system block and are global across presets.
    // When sax breath controller is enabled, reserve analog inputs for:
    // - 0: trim pot
    // - breathIndex: breath sensor
    // Note: analog index 2 was historically reserved as a "pitch amount" pot.
    // That prevented using a second pressure sensor for Pitch Bend while sax breath
    // was enabled. Keep only trim + breath reserved so other analog inputs can be
    // freely configured (e.g. PITCH_BEND).
    static constexpr size_t SAX_BREATH_ENABLE_SETTING_INDEX      = 6;
    static constexpr size_t SAX_BREATH_ANALOG_INDEX_SETTING_INDEX = 7;

    const uint16_t enabled = _components.database().read(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                                         SAX_BREATH_ENABLE_SETTING_INDEX);

    if (!enabled)
    {
        return;
    }

    const uint16_t breathIndexSetting = _components.database().read(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                                                    SAX_BREATH_ANALOG_INDEX_SETTING_INDEX);

    const size_t breathIndex = static_cast<size_t>(breathIndexSetting);

    auto configReservedAnalog = [&](size_t index)
    {
        if (index >= ::io::analog::Collection::SIZE(::io::analog::GROUP_ANALOG_INPUTS))
        {
            return;
        }

        _components.database().update(database::Config::Section::analog_t::ENABLE, index, 1);
        _components.database().update(database::Config::Section::analog_t::INVERT, index, 0);
        _components.database().update(database::Config::Section::analog_t::TYPE, index, static_cast<uint16_t>(::io::analog::type_t::RESERVED));
        _components.database().update(database::Config::Section::analog_t::MIDI_ID, index, 0);
        _components.database().update(database::Config::Section::analog_t::CHANNEL, index, 1);
        _components.database().update(database::Config::Section::analog_t::LOWER_LIMIT, index, 0);
        _components.database().update(database::Config::Section::analog_t::UPPER_LIMIT, index, 127);
        _components.database().update(database::Config::Section::analog_t::LOWER_OFFSET, index, 0);
        _components.database().update(database::Config::Section::analog_t::UPPER_OFFSET, index, 0);
    };

    static constexpr size_t TRIM_ANALOG_INDEX        = 0;

    configReservedAnalog(breathIndex);

    if (breathIndex != TRIM_ANALOG_INDEX)
    {
        configReservedAnalog(TRIM_ANALOG_INDEX);
    }
}

void System::updateSax()
{
    if (_analog == nullptr)
    {
        return;
    }

    static constexpr size_t SAX_BREATH_ENABLE_SETTING_INDEX       = 6;
    static constexpr size_t SAX_BREATH_ANALOG_INDEX_SETTING_INDEX  = 7;
    static constexpr size_t SAX_BREATH_CC_SETTING_INDEX            = 8;
    static constexpr size_t SAX_BREATH_MID_PERCENT_SETTING_INDEX   = 10;
    static constexpr size_t TRIM_ANALOG_INDEX                      = 0;
    static constexpr uint16_t UNKNOWN                               = 0xFFFF;
    static constexpr int32_t TRIM_RANGE_PERCENT                     = 15;

    const uint16_t enabled = _components.database().read(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                                         SAX_BREATH_ENABLE_SETTING_INDEX);

    if (!enabled)
    {
        _lastSaxBreathValue = UNKNOWN;
        updateSaxFingering();
        return;
    }

    const size_t breathIndex = static_cast<size_t>(
        _components.database().read(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                   SAX_BREATH_ANALOG_INDEX_SETTING_INDEX));

    if (breathIndex >= ::io::analog::Collection::SIZE(::io::analog::GROUP_ANALOG_INPUTS))
    {
        return;
    }

    // Force fast polling for dedicated sax inputs.
    _analog->updateSingle(breathIndex);
    if (breathIndex != TRIM_ANALOG_INDEX)
    {
        _analog->updateSingle(TRIM_ANALOG_INDEX);
    }
    // Also poll pitch-related analog input fast for sax playability.
    // Keep legacy index 2 (used as an internal trim pot), but if Pitch Bend is
    // configured on a different analog input, fast-poll it too.
    if (2 < ::io::analog::Collection::SIZE(::io::analog::GROUP_ANALOG_INPUTS))
    {
        _analog->updateSingle(2);
    }

    for (size_t i = 0; i < ::io::analog::Collection::SIZE(::io::analog::GROUP_ANALOG_INPUTS); i++)
    {
        if ((i == breathIndex) || (i == TRIM_ANALOG_INDEX) || (i == 2))
        {
            continue;
        }

        const uint16_t enabled = _components.database().read(database::Config::Section::analog_t::ENABLE, i);
        if (!enabled)
        {
            continue;
        }

        const uint16_t type = _components.database().read(database::Config::Section::analog_t::TYPE, i);
        if (type == static_cast<uint16_t>(::io::analog::type_t::PITCH_BEND))
        {
            _analog->updateSingle(i);
            break;
        }
    }

    const uint16_t midPercentRaw = _components.database().read(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                                              SAX_BREATH_MID_PERCENT_SETTING_INDEX);
    const uint16_t ccMode        = _components.database().read(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                                              SAX_BREATH_CC_SETTING_INDEX);

    const uint16_t breathRaw = _analog->value(breathIndex);

    if (breathRaw == UNKNOWN)
    {
        return;
    }

    int32_t midPercent = static_cast<int32_t>(core::util::CONSTRAIN(midPercentRaw, static_cast<uint16_t>(0), static_cast<uint16_t>(100)));

    // Apply trim pot delta around base midPercent.
    // trim pot is 0..127, centered at ~64.
    if (breathIndex != TRIM_ANALOG_INDEX)
    {
        const uint16_t trimRaw = _analog->value(TRIM_ANALOG_INDEX);

        if (trimRaw != UNKNOWN)
        {
            const int32_t centered = static_cast<int32_t>(trimRaw) - 64;
            const int32_t delta    = (centered * TRIM_RANGE_PERCENT) / 64;
            midPercent             = core::util::CONSTRAIN(midPercent + delta, static_cast<int32_t>(0), static_cast<int32_t>(100));
        }
    }

    const uint16_t midValue = static_cast<uint16_t>((midPercent * 127 + 50) / 100);

    uint16_t outValue = 0;

    if (breathRaw > midValue)
    {
        const uint16_t denom = static_cast<uint16_t>(127 - midValue);
        const uint16_t diff  = static_cast<uint16_t>(breathRaw - midValue);

        if (denom > 0)
        {
            outValue = static_cast<uint16_t>((static_cast<uint32_t>(diff) * 127) / denom);
        }
        else
        {
            outValue = 0;
        }
    }

    outValue = core::util::CONSTRAIN(outValue, static_cast<uint16_t>(0), static_cast<uint16_t>(127));

    if ((_lastSaxBreathValue != UNKNOWN) && (outValue == _lastSaxBreathValue))
    {
        return;
    }

    _lastSaxBreathValue = outValue;

    auto sendCC = [&](uint8_t cc)
    {
        messaging::Event event = {};
        event.componentIndex   = 0;
        event.channel          = resolvedMidiChannel();
        event.index            = cc;
        event.value            = outValue;
        event.message          = midi::messageType_t::CONTROL_CHANGE;

        MidiDispatcher.notify(messaging::eventType_t::ANALOG, event);
    };

    switch (ccMode)
    {
    case 2:
        sendCC(2);
        break;

    case 11:
        sendCC(11);
        break;

    case 13:
        sendCC(2);
        sendCC(11);
        break;

    default:
        // fallback: CC2
        sendCC(2);
        break;
    }

    updateSaxFingering();
}

void System::updateSaxFingering()
{
    // UI/firmware contract: 26 keys, split into lo14 + hi12.
    static constexpr uint8_t  KEY_COUNT   = 26;
    static constexpr uint8_t  LO_BITS     = 14;
    static constexpr uint32_t LO_MASK     = (1u << LO_BITS) - 1u; // 0x3FFF
    static constexpr uint8_t  HI_BITS     = KEY_COUNT - LO_BITS;  // 12
    static constexpr uint32_t HI_MASK     = (1u << HI_BITS) - 1u; // 0x0FFF
    static constexpr uint32_t ENABLE_BIT  = (1u << HI_BITS);      // 0x1000

    if (_buttons == nullptr)
    {
        return;
    }

    const auto maybeMask = _buttons->saxFingeringMask();
    if (!maybeMask.has_value())
    {
        return;
    }

    const uint32_t mask = maybeMask.value();

    if (mask == _lastSaxFingeringMask)
    {
        return;
    }

    _lastSaxFingeringMask = mask;

    // Resolve transpose (0..48 where 24 == 0 semitones).
    const uint16_t transposeRaw = _components.database().read(database::Config::Section::system_t::SYSTEM_SETTINGS, 11);
    const int32_t  transpose    = static_cast<int32_t>(core::util::CONSTRAIN(transposeRaw, static_cast<uint16_t>(0), static_cast<uint16_t>(48))) - 24;

    int16_t resolvedNote = -1;

    for (uint16_t entry = 0; entry < 128; entry++)
    {
        const uint32_t hiEnable = _components.database().read(database::Config::Section::global_t::SAX_FINGERING_MASK_HI12_ENABLE, entry);
        if ((hiEnable & ENABLE_BIT) == 0)
        {
            continue;
        }

        const uint32_t lo = _components.database().read(database::Config::Section::global_t::SAX_FINGERING_MASK_LO14, entry) & LO_MASK;
        const uint32_t hi = (hiEnable & HI_MASK);
        const uint32_t entryMask = lo | (hi << LO_BITS);

        if (entryMask != mask)
        {
            continue;
        }

        const uint32_t noteRaw = _components.database().read(database::Config::Section::global_t::SAX_FINGERING_NOTE, entry) & 0x7Fu;
        int32_t noteWithTranspose = static_cast<int32_t>(noteRaw) + transpose;
        noteWithTranspose         = core::util::CONSTRAIN(noteWithTranspose, static_cast<int32_t>(0), static_cast<int32_t>(127));

        resolvedNote = static_cast<int16_t>(noteWithTranspose);
        break;
    }

    if (resolvedNote == _lastSaxFingeringNote)
    {
        return;
    }

    const uint8_t channel = resolvedMidiChannel();

    // Monophonic: turn off previous note, then turn on new note.
    if (_lastSaxFingeringNote >= 0)
    {
        messaging::Event off = {};
        off.componentIndex   = 0;
        off.channel          = channel;
        off.index            = static_cast<uint16_t>(_lastSaxFingeringNote);
        off.value            = 0;
        off.message          = midi::messageType_t::NOTE_OFF;
        MidiDispatcher.notify(messaging::eventType_t::BUTTON, off);
    }

    if (resolvedNote >= 0)
    {
        messaging::Event on = {};
        on.componentIndex   = 0;
        on.channel          = channel;
        on.index            = static_cast<uint16_t>(resolvedNote);
        on.value            = 127;
        on.message          = midi::messageType_t::NOTE_ON;
        MidiDispatcher.notify(messaging::eventType_t::BUTTON, on);
    }

    _lastSaxFingeringNote = resolvedNote;
}

void System::backup()
{
    uint8_t backupRequest[] = {
        0xF0,
        SYS_EX_MID.id1,
        SYS_EX_MID.id2,
        SYS_EX_MID.id3,
        0x00,    // request
        0x7F,    // all message parts,
        static_cast<uint8_t>(lib::sysexconf::wish_t::BACKUP),
        static_cast<uint8_t>(lib::sysexconf::amount_t::ALL),
        0x00,    // block - set later in the loop
        0x00,    // section - set later in the loop
        0x00,    // index MSB - unused but required
        0x00,    // index LSB - unused but required
        0x00,    // new value MSB - unused but required
        0x00,    // new value LSB - unused but required
        0xF7
    };

    uint16_t presetChangeRequest[] = {
        static_cast<uint8_t>(lib::sysexconf::wish_t::SET),
        static_cast<uint8_t>(lib::sysexconf::amount_t::SINGLE),
        static_cast<uint8_t>(sys::Config::block_t::GLOBAL),
        static_cast<uint8_t>(sys::Config::Section::global_t::SYSTEM_SETTINGS),
        0x00,    // index 0 (active preset) MSB
        0x00,    // index 0 (active preset) LSB
        0x00,    // preset value MSB - always 0
        0x00     // preset value LSB - set later in the loop
    };

    static constexpr uint8_t PRESET_CHANGE_REQUEST_SIZE         = 8;
    static constexpr uint8_t PRESET_CHANGE_REQUEST_PRESET_INDEX = 7;
    static constexpr uint8_t BACKUP_REQUEST_BLOCK_INDEX         = 8;
    static constexpr uint8_t BACKUP_REQUEST_SECTION_INDEX       = 9;

    uint8_t currentPreset = _components.database().getPreset();

    // make sure not to report any errors while performing backup
    _sysExConf.setUserErrorIgnoreMode(true);

    // first message sent as an response should be restore start marker
    // this is used to indicate that restore procedure is in progress
    uint16_t restoreMarker = SYSEX_CR_RESTORE_START;
    _sysExConf.sendCustomMessage(&restoreMarker, 1, false);

    // send internally created backup requests to sysex handler for all presets, blocks and presets
    for (uint8_t preset = 0; preset < _components.database().getSupportedPresets(); preset++)
    {
        _components.database().setPreset(preset);
        presetChangeRequest[PRESET_CHANGE_REQUEST_PRESET_INDEX] = preset;
        _sysExConf.sendCustomMessage(presetChangeRequest, PRESET_CHANGE_REQUEST_SIZE, false);

        for (size_t block = 0; block < _sysExConf.blocks(); block++)
        {
            backupRequest[BACKUP_REQUEST_BLOCK_INDEX] = block;

            for (size_t section = 0; section < _sysExConf.sections(block); section++)
            {
                // some sections are irrelevant for backup and should therefore be skipped

                if (
                    (block == static_cast<uint8_t>(sys::Config::block_t::LEDS)) &&
                    ((section == static_cast<uint8_t>(sys::Config::Section::leds_t::TEST_COLOR)) ||
                     (section == static_cast<uint8_t>(sys::Config::Section::leds_t::TEST_BLINK))))
                {
                    continue;
                }

                backupRequest[BACKUP_REQUEST_SECTION_INDEX] = section;
                _sysExConf.handleMessage(backupRequest, sizeof(backupRequest));
            }
        }
    }

    _components.database().setPreset(currentPreset);
    presetChangeRequest[PRESET_CHANGE_REQUEST_PRESET_INDEX] = currentPreset;
    _sysExConf.sendCustomMessage(presetChangeRequest, PRESET_CHANGE_REQUEST_SIZE, false);

    // mark the end of restore procedure
    restoreMarker = SYSEX_CR_RESTORE_END;
    _sysExConf.sendCustomMessage(&restoreMarker, 1, false);

    // finally, send back full backup request to mark the end of sending
    uint16_t endMarker = SYSEX_CR_FULL_BACKUP;
    _sysExConf.sendCustomMessage(&endMarker, 1);
    _sysExConf.setUserErrorIgnoreMode(false);

    _backupRestoreState = backupRestoreState_t::NONE;
}

ioComponent_t System::checkComponents()
{
    switch (_componentIndex)
    {
    case ioComponent_t::BUTTONS:
    {
        _componentIndex = ioComponent_t::ENCODERS;
    }
    break;

    case ioComponent_t::ENCODERS:
    {
        _componentIndex = ioComponent_t::ANALOG;
    }
    break;

    case ioComponent_t::ANALOG:
    {
        _componentIndex = ioComponent_t::LEDS;
    }
    break;

    case ioComponent_t::LEDS:
    {
        _componentIndex = ioComponent_t::I2C;
    }
    break;

    case ioComponent_t::I2C:
    {
        _componentIndex = ioComponent_t::TOUCHSCREEN;
    }
    break;

    case ioComponent_t::TOUCHSCREEN:
    default:
    {
        _componentIndex = ioComponent_t::BUTTONS;
    }
    break;
    }

    // For each component, allow up to MAX_UPDATES_PER_RUN updates:
    // This is done so that no single component update takes too long, and
    // thus making other things wait.

    auto component         = _components.io().at(static_cast<size_t>(_componentIndex));
    auto maxComponentIndex = component->maxComponentUpdateIndex();
    auto loopIterations    = maxComponentIndex >= MAX_UPDATES_PER_RUN ? MAX_UPDATES_PER_RUN : !maxComponentIndex ? 1
                                                                                                                 : maxComponentIndex;

    if (component != nullptr)
    {
        for (size_t i = 0; i < loopIterations; i++)
        {
            component->updateSingle(_componentUpdateIndex[static_cast<size_t>(_componentIndex)]);

            if (++_componentUpdateIndex[static_cast<size_t>(_componentIndex)] >= maxComponentIndex)
            {
                _componentUpdateIndex[static_cast<size_t>(_componentIndex)] = 0;
            }
        }
    }

    // return the last processed io component
    return _componentIndex;
}

void System::checkProtocols()
{
    for (size_t i = 0; i < _components.protocol().size(); i++)
    {
        auto component = _components.protocol().at(i);

        if (component != nullptr)
        {
            component->read();
        }
    }
}

void System::forceComponentRefresh()
{
    if (_components.database().read(database::Config::Section::system_t::SYSTEM_SETTINGS,
                                    Config::systemSetting_t::DISABLE_FORCED_REFRESH_AFTER_PRESET_CHANGE))
    {
        return;
    }

    // extra check here - it's possible that preset was changed and then backup/restore procedure started
    // in that case this would get called
    if (_backupRestoreState != backupRestoreState_t::NONE)
    {
        return;
    }

    messaging::Event event = {};
    event.systemMessage    = messaging::systemMessage_t::FORCE_IO_REFRESH;

    MidiDispatcher.notify(messaging::eventType_t::SYSTEM, event);
}

void System::SysExDataHandler::sendResponse(uint8_t* array, uint16_t size)
{
    messaging::Event event = {};
    event.systemMessage    = messaging::systemMessage_t::SYS_EX_RESPONSE;
    event.message          = midi::messageType_t::SYS_EX;
    event.sysEx            = array;
    event.sysExLength      = size;

    MidiDispatcher.notify(messaging::eventType_t::SYSTEM, event);
}

uint8_t System::SysExDataHandler::customRequest(uint16_t request, CustomResponse& customResponse)
{
    uint8_t result = sys::Config::Status::ACK;

    auto appendSW = [&customResponse]()
    {
        customResponse.append(SW_VERSION_MAJOR);
        customResponse.append(SW_VERSION_MINOR);
        customResponse.append(SW_VERSION_REVISION);
    };

    auto appendHW = [&customResponse]()
    {
        customResponse.append((PROJECT_TARGET_UID >> 24) & static_cast<uint32_t>(0xFF));
        customResponse.append((PROJECT_TARGET_UID >> 16) & static_cast<uint32_t>(0xFF));
        customResponse.append((PROJECT_TARGET_UID >> 8) & static_cast<uint32_t>(0xFF));
        customResponse.append(PROJECT_TARGET_UID & static_cast<uint32_t>(0xFF));
    };

    switch (request)
    {
    case SYSEX_CR_FIRMWARE_VERSION:
    {
        appendSW();
    }
    break;

    case SYSEX_CR_HARDWARE_UID:
    {
        appendHW();
    }
    break;

    case SYSEX_CR_FIRMWARE_VERSION_HARDWARE_UID:
    {
        appendSW();
        appendHW();
    }
    break;

    case SYSEX_CR_FACTORY_RESET:
    {
        if (!_system._components.database().factoryReset())
        {
            result = static_cast<uint8_t>(lib::sysexconf::status_t::ERROR_WRITE);
        }
    }
    break;

    case SYSEX_CR_REBOOT_APP:
    {
        _system._hwa.reboot(fw_selector::fwType_t::APPLICATION);
    }
    break;

    case SYSEX_CR_REBOOT_BTLDR:
    {
        _system._hwa.reboot(fw_selector::fwType_t::BOOTLOADER);
    }
    break;

    case SYSEX_CR_MAX_COMPONENTS:
    {
        customResponse.append(buttons::Collection::SIZE());
        customResponse.append(encoders::Collection::SIZE());
        customResponse.append(analog::Collection::SIZE());
        customResponse.append(leds::Collection::SIZE());
        customResponse.append(touchscreen::Collection::SIZE());
    }
    break;

    case SYSEX_CR_SUPPORTED_PRESETS:
    {
        customResponse.append(_system._components.database().getSupportedPresets());
    }
    break;

    case SYSEX_CR_BOOTLOADER_SUPPORT:
    {
        customResponse.append(1);
    }
    break;

    case SYSEX_CR_SAX_PB_CENTER_CAPTURE:
    {
        messaging::Event event = {};
        event.systemMessage    = messaging::systemMessage_t::SAX_PB_CENTER_CAPTURE_REQ;
        MidiDispatcher.notify(messaging::eventType_t::SYSTEM, event);
    }
    break;

    case SYSEX_CR_FULL_BACKUP:
    {
        // no response here, just set flag internally that backup needs to be done
        _system._backupRestoreState = backupRestoreState_t::BACKUP;

        messaging::Event event = {};
        event.componentIndex   = 0;
        event.channel          = 0;
        event.index            = 0;
        event.value            = 0;
        event.systemMessage    = messaging::systemMessage_t::BACKUP;

        MidiDispatcher.notify(messaging::eventType_t::SYSTEM, event);
    }
    break;

    case SYSEX_CR_RESTORE_START:
    {
        _system._backupRestoreState = backupRestoreState_t::RESTORE;
        _system._sysExConf.setUserErrorIgnoreMode(true);

        messaging::Event event = {};
        event.componentIndex   = 0;
        event.channel          = 0;
        event.index            = 0;
        event.value            = 0;
        event.systemMessage    = messaging::systemMessage_t::RESTORE_START;

        MidiDispatcher.notify(messaging::eventType_t::SYSTEM, event);
    }
    break;

    case SYSEX_CR_RESTORE_END:
    {
        _system._backupRestoreState = backupRestoreState_t::NONE;
        _system._sysExConf.setUserErrorIgnoreMode(false);

        messaging::Event event = {};
        event.componentIndex   = 0;
        event.channel          = 0;
        event.index            = 0;
        event.value            = 0;
        event.systemMessage    = messaging::systemMessage_t::RESTORE_END;

        MidiDispatcher.notify(messaging::eventType_t::SYSTEM, event);
    }
    break;

    default:
    {
        result = sys::Config::Status::ERROR_NOT_SUPPORTED;
    }
    break;
    }

    return result;
}

uint8_t System::SysExDataHandler::get(uint8_t   block,
                                      uint8_t   section,
                                      uint16_t  index,
                                      uint16_t& value)
{
    return ConfigHandler.get(static_cast<sys::Config::block_t>(block), section, index, value);
}

uint8_t System::SysExDataHandler::set(uint8_t  block,
                                      uint8_t  section,
                                      uint16_t index,
                                      uint16_t value)
{
    return ConfigHandler.set(static_cast<sys::Config::block_t>(block), section, index, value);
}

void System::DatabaseHandlers::presetChange(uint8_t preset)
{
    if (_system._backupRestoreState == backupRestoreState_t::NONE)
    {
        _system._scheduler.registerTask({ SCHEDULED_TASK_PRESET,
                                          PRESET_CHANGE_NOTIFY_DELAY,
                                          [&]()
                                          {
                                              messaging::Event event = {};
                                              event.componentIndex   = 0;
                                              event.channel          = 0;
                                              event.index            = _system._components.database().getPreset();
                                              event.value            = 0;
                                              event.systemMessage    = messaging::systemMessage_t::PRESET_CHANGED;

                                              MidiDispatcher.notify(messaging::eventType_t::SYSTEM, event);

                                              _system.forceComponentRefresh();
                                          } });
    }
}

void System::DatabaseHandlers::initialized()
{
    // nothing to do here
}

void System::DatabaseHandlers::factoryResetStart()
{
    messaging::Event event = {};
    event.componentIndex   = 0;
    event.channel          = 0;
    event.index            = 0;
    event.value            = 0;
    event.systemMessage    = messaging::systemMessage_t::FACTORY_RESET_START;

    MidiDispatcher.notify(messaging::eventType_t::SYSTEM, event);
}

void System::DatabaseHandlers::factoryResetDone()
{
    messaging::Event event = {};
    event.componentIndex   = 0;
    event.channel          = 0;
    event.index            = 0;
    event.value            = 0;
    event.systemMessage    = messaging::systemMessage_t::FACTORY_RESET_END;

    MidiDispatcher.notify(messaging::eventType_t::SYSTEM, event);
}

std::optional<uint8_t> System::sysConfigGet(sys::Config::Section::global_t section, size_t index, uint16_t& value)
{
    if (section == sys::Config::Section::global_t::SAX_FINGERING_CURRENT_MASK)
    {
        // Read-only: expose current pressed key mask without modifying the table.
        // index 0 -> lo14, index 1 -> hi10
        static constexpr uint8_t  KEY_COUNT = 24;
        static constexpr uint8_t  LO_BITS   = 14;
        static constexpr uint32_t LO_MASK   = (1u << LO_BITS) - 1u;
        static constexpr uint8_t  HI_BITS   = KEY_COUNT - LO_BITS;
        static constexpr uint32_t HI_MASK   = (1u << HI_BITS) - 1u;

        if ((index > 1) || (_buttons == nullptr))
        {
            return sys::Config::Status::ERROR_NOT_SUPPORTED;
        }

        const auto maybeMask = _buttons->saxFingeringMask();
        if (!maybeMask.has_value())
        {
            return sys::Config::Status::ERROR_NOT_SUPPORTED;
        }

        const uint32_t mask  = maybeMask.value() & ((1u << KEY_COUNT) - 1u);
        const uint16_t lo14  = static_cast<uint16_t>(mask & LO_MASK);
        const uint16_t hi10  = static_cast<uint16_t>((mask >> LO_BITS) & HI_MASK);

        value = (index == 0) ? lo14 : hi10;
        return sys::Config::Status::ACK;
    }

    if ((section == sys::Config::Section::global_t::SAX_FINGERING_MASK_LO14) ||
        (section == sys::Config::Section::global_t::SAX_FINGERING_MASK_HI12_ENABLE) ||
        (section == sys::Config::Section::global_t::SAX_FINGERING_NOTE))
    {
        if (index >= 128)
        {
            return sys::Config::Status::ERROR_NOT_SUPPORTED;
        }

        const auto dbSection = util::Conversion::SYS_2_DB_SECTION(section);
        if (dbSection == database::Config::Section::global_t::AMOUNT)
        {
            return sys::Config::Status::ERROR_NOT_SUPPORTED;
        }

        uint32_t readValue = 0;
        const auto result = _components.database().read(dbSection, index, readValue)
                                ? sys::Config::Status::ACK
                                : sys::Config::Status::ERROR_READ;
        value = readValue;
        return result;
    }

    if (section != sys::Config::Section::global_t::SYSTEM_SETTINGS)
    {
        return std::nullopt;
    }

    // Handle only custom system settings here.
    // Non-custom settings (ACTIVE_PRESET, PRESET_PRESERVE, etc) are handled by database::Admin.
    const size_t customStart = static_cast<size_t>(database::Config::systemSetting_t::CUSTOM_SYSTEM_SETTING_START);
    const size_t customEnd   = static_cast<size_t>(database::Config::systemSetting_t::CUSTOM_SYSTEM_SETTING_END);

    if ((index < customStart) || (index >= customEnd))
    {
        return std::nullopt;
    }

    uint32_t readValue;

    auto result = _components.database().read(database::Config::Section::system_t::SYSTEM_SETTINGS, index, readValue)
                      ? sys::Config::Status::ACK
                      : sys::Config::Status::ERROR_READ;

    // Hide internal init flag bit from UI for sax transpose.
    if (index == 11)
    {
        readValue &= 0x7FFFu;
    }

    value = readValue;

    return result;
}

std::optional<uint8_t> System::sysConfigSet(sys::Config::Section::global_t section, size_t index, uint16_t value)
{
    if (section == sys::Config::Section::global_t::SAX_FINGERING_CLEAR)
    {
        // Write-only: clear current pressed/latching state for SAX_FINGERING_KEY.
        // index 0, value 1 -> trigger
        if ((index != 0) || (value != 1) || (_buttons == nullptr))
        {
            return sys::Config::Status::ERROR_NOT_SUPPORTED;
        }

        _buttons->clearSaxFingeringState();

        // Force recompute on next tick.
        _lastSaxFingeringMask = 0xFFFFFFFFu;

        return sys::Config::Status::ACK;
    }

    if (section == sys::Config::Section::global_t::SAX_FINGERING_CAPTURE)
    {
        // Write-only: capture current key mask into entry 'index'.
        // If value < 128, also update note; if value >= 128, keep existing note.
        static constexpr uint8_t  KEY_COUNT   = 26;
        static constexpr uint8_t  LO_BITS     = 14;
        static constexpr uint32_t LO_MASK     = (1u << LO_BITS) - 1u;
        static constexpr uint8_t  HI_BITS     = KEY_COUNT - LO_BITS;
        static constexpr uint32_t HI_MASK     = (1u << HI_BITS) - 1u;
        static constexpr uint32_t ENABLE_BIT  = (1u << HI_BITS);

        if ((index >= 128) || (_buttons == nullptr))
        {
            return sys::Config::Status::ERROR_NOT_SUPPORTED;
        }

        const auto maybeMask = _buttons->saxFingeringMask();
        if (!maybeMask.has_value())
        {
            return sys::Config::Status::ERROR_NOT_SUPPORTED;
        }

        const uint32_t mask = maybeMask.value();

        const uint16_t lo14      = static_cast<uint16_t>(mask & LO_MASK);
        const uint16_t hi12      = static_cast<uint16_t>((mask >> LO_BITS) & HI_MASK);
        const uint16_t hiEnable  = static_cast<uint16_t>(hi12 | ENABLE_BIT);

        bool ok = true;
        ok &= _components.database().update(database::Config::Section::global_t::SAX_FINGERING_MASK_LO14, index, lo14);
        ok &= _components.database().update(database::Config::Section::global_t::SAX_FINGERING_MASK_HI12_ENABLE, index, hiEnable);

        if (value < 128)
        {
            ok &= _components.database().update(database::Config::Section::global_t::SAX_FINGERING_NOTE, index, static_cast<uint8_t>(value & 0x7F));
        }

        // Force recompute on next tick.
        _lastSaxFingeringMask = 0xFFFFFFFFu;

        return ok ? sys::Config::Status::ACK : sys::Config::Status::ERROR_WRITE;
    }

    if ((section == sys::Config::Section::global_t::SAX_FINGERING_MASK_LO14) ||
        (section == sys::Config::Section::global_t::SAX_FINGERING_MASK_HI12_ENABLE) ||
        (section == sys::Config::Section::global_t::SAX_FINGERING_NOTE))
    {
        if (index >= 128)
        {
            return sys::Config::Status::ERROR_NOT_SUPPORTED;
        }

        const auto dbSection = util::Conversion::SYS_2_DB_SECTION(section);
        if (dbSection == database::Config::Section::global_t::AMOUNT)
        {
            return sys::Config::Status::ERROR_NOT_SUPPORTED;
        }

        const auto result = _components.database().update(dbSection, index, value)
                                ? sys::Config::Status::ACK
                                : sys::Config::Status::ERROR_WRITE;

        if (result == sys::Config::Status::ACK)
        {
            _lastSaxFingeringMask = 0xFFFFFFFFu;
        }

        return result;
    }

    if (section != sys::Config::Section::global_t::SYSTEM_SETTINGS)
    {
        return std::nullopt;
    }

    const size_t customStart = static_cast<size_t>(database::Config::systemSetting_t::CUSTOM_SYSTEM_SETTING_START);
    const size_t customEnd   = static_cast<size_t>(database::Config::systemSetting_t::CUSTOM_SYSTEM_SETTING_END);

    if ((index < customStart) || (index >= customEnd))
    {
        return std::nullopt;
    }

    // Preserve internal init flag bit for sax transpose and always mark as initialized.
    if (index == 11)
    {
        static constexpr uint16_t SAX_TRANSPOSE_INIT_FLAG  = 0x8000;
        static constexpr uint16_t SAX_TRANSPOSE_VALUE_MASK = 0x7FFF;
        value = static_cast<uint16_t>(SAX_TRANSPOSE_INIT_FLAG | (value & SAX_TRANSPOSE_VALUE_MASK));
    }

    auto result = _components.database().update(database::Config::Section::system_t::SYSTEM_SETTINGS, index, value)
                      ? sys::Config::Status::ACK
                      : sys::Config::Status::ERROR_WRITE;

    // If sax/breath settings change, ensure reserved analog config in current preset.
    if (result == sys::Config::Status::ACK)
    {
        if ((index == 6) || (index == 7))
        {
            ensureSaxAnalogConfigured();
        }

        // Apply pitch bend deadzone immediately when changed from UI.
        if (index == 12)
        {
            if (_analog != nullptr)
            {
                _analog->setPitchBendDeadzone(value);
            }
        }
    }

    return result;
}