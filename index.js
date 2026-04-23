import {
    characters,
    chat_metadata,
    eventSource,
    event_types,
    main_api,
    saveSettingsDebounced,
    this_chid,
} from '../../../script.js';
import {
    extension_settings,
    getContext,
    writeExtensionField,
} from '../../extensions.js';
import { POPUP_RESULT, POPUP_TYPE, Popup } from '../../popup.js';
import { getPresetManager } from '../../preset-manager.js';

const EXTENSION_NAME = 'character-preset-binder';
const CARD_FIELD = 'character_preset_binder';
const CHAT_FIELD = 'character_preset_binder';
const DROPDOWN_OPTION_ID = 'character_preset_binder_bind';
const CHANGE_TIMEOUT_MS = 3000;

const defaultSettings = {
    notifyOnAutoSwitch: true,
    legacyCharacterBindings: {},
};

function getSettings() {
    if (!extension_settings[EXTENSION_NAME] || typeof extension_settings[EXTENSION_NAME] !== 'object') {
        extension_settings[EXTENSION_NAME] = {
            notifyOnAutoSwitch: defaultSettings.notifyOnAutoSwitch,
            legacyCharacterBindings: {},
        };
    }

    const settings = extension_settings[EXTENSION_NAME];
    settings.notifyOnAutoSwitch ??= defaultSettings.notifyOnAutoSwitch;
    settings.legacyCharacterBindings ??= {};
    return settings;
}

function normalizeApiId(apiId = main_api) {
    return apiId === 'koboldhorde' ? 'kobold' : apiId;
}

function normalizeBinding(binding) {
    if (!binding) {
        return null;
    }

    if (typeof binding === 'string') {
        return { presetName: binding, apiId: normalizeApiId() };
    }

    if (typeof binding === 'object' && binding.presetName) {
        return {
            presetName: String(binding.presetName),
            apiId: normalizeApiId(binding.apiId),
        };
    }

    return null;
}

function getCurrentCharacter() {
    return this_chid !== undefined ? characters[this_chid] : null;
}

function getCharacterBinding() {
    const character = getCurrentCharacter();
    const cardBinding = normalizeBinding(character?.data?.extensions?.[CARD_FIELD]);
    if (cardBinding) {
        return cardBinding;
    }

    const settings = getSettings();
    const avatarBinding = normalizeBinding(settings.legacyCharacterBindings?.[character?.avatar]);
    if (avatarBinding) {
        return avatarBinding;
    }

    return normalizeBinding(settings[this_chid]);
}

function getChatBinding() {
    return normalizeBinding(chat_metadata?.[CHAT_FIELD]);
}

function getActiveBinding() {
    const chatBinding = getChatBinding();
    if (chatBinding) {
        return { ...chatBinding, source: 'chat' };
    }

    const characterBinding = getCharacterBinding();
    if (characterBinding) {
        return { ...characterBinding, source: 'character card' };
    }

    return null;
}

function getCurrentPresetInfo() {
    const apiId = normalizeApiId();
    const manager = getPresetManager(apiId);
    if (!manager) {
        return null;
    }

    const presetName = manager.getSelectedPresetName();
    return presetName ? { apiId, presetName } : null;
}

function getPresetNames(apiId = normalizeApiId()) {
    const manager = getPresetManager(apiId);
    return manager ? manager.getAllPresets() : [];
}

function getSelectedBindingFromPanel() {
    const selectedPreset = String($('#cpb_preset_select').val() || '');
    const apiId = normalizeApiId(String($('#cpb_api_id').val() || main_api));

    if (!selectedPreset) {
        toastr.warning('请先选择一个预设。');
        return null;
    }

    return { apiId, presetName: selectedPreset };
}

async function setChatBinding(binding) {
    const context = getContext();
    if (!context.chatId) {
        toastr.warning('请先打开一个聊天，再绑定预设。');
        return false;
    }

    chat_metadata[CHAT_FIELD] = binding;
    await context.saveMetadata();
    updatePanel();
    return true;
}

async function clearChatBinding() {
    if (!chat_metadata?.[CHAT_FIELD]) {
        toastr.info('当前聊天没有绑定预设。');
        return false;
    }

    delete chat_metadata[CHAT_FIELD];
    await getContext().saveMetadata();
    updatePanel();
    return true;
}

async function setCharacterBinding(binding) {
    if (this_chid === undefined || !getCurrentCharacter()) {
        toastr.warning('请先选择一个角色，再将预设绑定到角色卡。');
        return false;
    }

    await writeExtensionField(this_chid, CARD_FIELD, binding);
    updatePanel();
    return true;
}

async function clearCharacterBinding() {
    if (this_chid === undefined || !getCurrentCharacter()) {
        toastr.warning('请先选择一个角色。');
        return false;
    }

    await writeExtensionField(this_chid, CARD_FIELD, null);
    updatePanel();
    return true;
}

function refreshPresetSelect() {
    const current = getCurrentPresetInfo();
    const apiId = current?.apiId ?? normalizeApiId();
    const presetNames = getPresetNames(apiId);
    const selected = current?.presetName ?? presetNames[0] ?? '';

    $('#cpb_api_id').val(apiId);
    const select = $('#cpb_preset_select');
    select.empty();

    if (!presetNames.length) {
        select.append($('<option>', { value: '', text: '未找到预设' }));
        select.prop('disabled', true);
        return;
    }

    for (const presetName of presetNames) {
        select.append($('<option>', { value: presetName, text: presetName }));
    }

    select.val(selected);
    select.prop('disabled', false);
}

function formatBinding(binding) {
    return binding ? `${binding.presetName} (${binding.apiId})` : '无';
}

function updatePanel() {
    if (!$('#character_preset_binder_container').length) {
        return;
    }

    const current = getCurrentPresetInfo();
    const chatBinding = getChatBinding();
    const characterBinding = getCharacterBinding();
    const activeBinding = getActiveBinding();
    const character = getCurrentCharacter();

    $('#cpb_current_preset').text(current ? formatBinding(current) : '当前 API 不可用');
    $('#cpb_chat_binding').text(formatBinding(chatBinding));
    $('#cpb_character_binding').text(formatBinding(characterBinding));
    $('#cpb_active_binding').text(activeBinding ? `${formatBinding(activeBinding)}，来源：${activeBinding.source === 'chat' ? '聊天' : '角色卡'}` : '无');
    $('#cpb_character_name').text(character?.name ?? '未选择角色');
    $('#cpb_notify_switch').prop('checked', !!getSettings().notifyOnAutoSwitch);
    refreshPresetSelect();
}

async function bindFromPanel(target) {
    const binding = getSelectedBindingFromPanel();
    if (!binding) {
        return;
    }

    if (target === 'chat' && await setChatBinding(binding)) {
        toastr.success(`已将当前聊天绑定到预设：${binding.presetName}`);
    }

    if (target === 'character' && await setCharacterBinding(binding)) {
        toastr.success(`已将角色卡绑定到预设：${binding.presetName}`);
    }
}

function waitForPresetChange(apiId, presetName) {
    return new Promise((resolve) => {
        let done = false;
        const finish = (result) => {
            if (done) {
                return;
            }

            done = true;
            clearTimeout(timeout);
            eventSource.removeListener(event_types.PRESET_CHANGED, listener);
            resolve(result);
        };
        const listener = (event) => {
            if (normalizeApiId(event?.apiId) === apiId && event?.name === presetName) {
                finish(true);
            }
        };
        const timeout = setTimeout(() => finish(false), CHANGE_TIMEOUT_MS);
        eventSource.on(event_types.PRESET_CHANGED, listener);
    });
}

async function applyBinding(binding) {
    const target = normalizeBinding(binding);
    if (!target) {
        return false;
    }

    const currentApiId = normalizeApiId();
    if (target.apiId !== currentApiId) {
        console.warn(`[${EXTENSION_NAME}] Bound preset is for ${target.apiId}, current API is ${currentApiId}.`);
        return false;
    }

    const manager = getPresetManager(target.apiId);
    if (!manager) {
        console.warn(`[${EXTENSION_NAME}] No preset manager for API: ${target.apiId}`);
        return false;
    }

    if (manager.getSelectedPresetName() === target.presetName) {
        return true;
    }

    const presetValue = manager.findPreset(target.presetName);
    if (presetValue === undefined) {
        toastr.warning(`未找到预设：${target.presetName}`);
        return false;
    }

    const changed = waitForPresetChange(target.apiId, target.presetName);
    manager.selectPreset(presetValue);
    const confirmed = await changed;

    if (!confirmed) {
        console.warn(`[${EXTENSION_NAME}] Preset change was not confirmed before timeout.`);
    }

    return true;
}

async function applyActiveBinding() {
    const activeBinding = getActiveBinding();
    if (!activeBinding) {
        return;
    }

    const applied = await applyBinding(activeBinding);
    if (applied && getSettings().notifyOnAutoSwitch) {
        toastr.info(`已自动切换预设：${activeBinding.presetName}`);
    }
}

function appendSettingsPanel() {
    if ($('#character_preset_binder_container').length) {
        return;
    }

    const panel = $(`
        <div id="character_preset_binder_container" class="character-preset-binder extension_container">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>角色预设绑定器</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div class="cpb-status-grid">
                        <span>当前角色</span><strong id="cpb_character_name">未选择角色</strong>
                        <span>当前预设</span><strong id="cpb_current_preset">不可用</strong>
                        <span>聊天绑定</span><strong id="cpb_chat_binding">无</strong>
                        <span>角色卡绑定</span><strong id="cpb_character_binding">无</strong>
                        <span>生效绑定</span><strong id="cpb_active_binding">无</strong>
                    </div>
                    <input id="cpb_api_id" type="hidden" />
                    <label for="cpb_preset_select">要绑定的预设</label>
                    <select id="cpb_preset_select" class="text_pole wide100p"></select>
                    <div class="cpb-button-row">
                        <button id="cpb_bind_chat" class="menu_button">绑定聊天</button>
                        <button id="cpb_unbind_chat" class="menu_button">解除聊天绑定</button>
                        <button id="cpb_bind_character" class="menu_button">绑定角色卡</button>
                        <button id="cpb_unbind_character" class="menu_button">解除角色卡绑定</button>
                    </div>
                    <label class="checkbox_label cpb-checkbox">
                        <input id="cpb_notify_switch" type="checkbox" />
                        自动切换预设时显示提示
                    </label>
                    <small>聊天绑定优先于角色卡绑定。</small>
                </div>
            </div>
        </div>
    `);

    const target = $('#extensions_settings2').length ? $('#extensions_settings2') : $('#extensions_settings');
    target.append(panel);

    $('#cpb_bind_chat').on('click', () => bindFromPanel('chat'));
    $('#cpb_unbind_chat').on('click', async () => {
        if (await clearChatBinding()) {
            toastr.info('已解除当前聊天的预设绑定。');
        }
    });
    $('#cpb_bind_character').on('click', () => bindFromPanel('character'));
    $('#cpb_unbind_character').on('click', async () => {
        if (await clearCharacterBinding()) {
            toastr.info('已解除角色卡的预设绑定。');
        }
    });
    $('#cpb_notify_switch').on('input', function () {
        getSettings().notifyOnAutoSwitch = !!$(this).prop('checked');
        saveSettingsDebounced();
    });
}

function getPresetSelectHtml() {
    const current = getCurrentPresetInfo();
    const presetNames = getPresetNames(current?.apiId);
    const selected = current?.presetName ?? '';

    if (!presetNames.length) {
        return '<option value="">未找到预设</option>';
    }

    return presetNames.map((presetName) => {
        const option = $('<option>', {
            value: presetName,
            text: presetName,
            selected: presetName === selected,
        });
        return option.prop('outerHTML');
    }).join('');
}

function showBindingPopup() {
    if (this_chid === undefined || !getCurrentCharacter()) {
        toastr.warning('请先选择一个角色，再绑定预设。');
        return;
    }

    const current = getCurrentPresetInfo();
    if (!current) {
        toastr.warning('当前 API 没有可用的预设管理器。');
        return;
    }

    const content = $('<div class="cpb-popup"></div>');
    content.append($('<h3></h3>').text('绑定预设到角色卡'));
    content.append($('<p></p>').append('角色：', $('<strong></strong>').text(getCurrentCharacter().name)));
    content.append($('<label for="cpb_popup_preset"></label>').text('预设'));
    content.append($(`<select id="cpb_popup_preset" class="text_pole wide100p">${getPresetSelectHtml()}</select>`));

    let popup;
    popup = new Popup(content, POPUP_TYPE.TEXT, '', {
        okButton: '绑定',
        cancelButton: '取消',
        wide: true,
        onClosing: async (instance) => {
            if (instance.result !== POPUP_RESULT.AFFIRMATIVE) {
                return true;
            }

            const presetName = String(instance.dlg.querySelector('#cpb_popup_preset')?.value || '');
            if (!presetName) {
                toastr.warning('请先选择一个预设。');
                return false;
            }

            await setCharacterBinding({ apiId: current.apiId, presetName });
            toastr.success(`已将角色卡绑定到预设：${presetName}`);
            return true;
        },
    });
    popup.show();
}

function appendCharacterDropdownOption() {
    if ($(`#${DROPDOWN_OPTION_ID}`).length) {
        return;
    }

    $('#char-management-dropdown').append(
        $('<option>', {
            id: DROPDOWN_OPTION_ID,
            value: DROPDOWN_OPTION_ID,
            text: '绑定预设到角色卡',
        }),
    );
}

function registerEvents() {
    eventSource.on(event_types.GENERATION_STARTED, applyActiveBinding);
    eventSource.on(event_types.CHAT_CHANGED, updatePanel);
    eventSource.on(event_types.PRESET_CHANGED, updatePanel);
    eventSource.on(event_types.MAIN_API_CHANGED, updatePanel);
    eventSource.on(event_types.CHARACTER_EDITED, updatePanel);
    eventSource.on(event_types.CHARACTER_MANAGEMENT_DROPDOWN, (selectedOptionId) => {
        if (selectedOptionId === DROPDOWN_OPTION_ID) {
            showBindingPopup();
        }
    });
}

jQuery(() => {
    getSettings();
    appendSettingsPanel();
    appendCharacterDropdownOption();
    registerEvents();
    updatePanel();
    console.debug(`[${EXTENSION_NAME}] 已加载`);
});
