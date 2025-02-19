<script setup lang="ts">
import { faChevronDown, faChevronUp, faPlus, faUpload } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { BAlert, BButton, BFormCheckbox, BFormGroup, BFormInput, BLink, BTab, BTabs } from "bootstrap-vue";
import { storeToRefs } from "pinia";
import { computed, ref, watch } from "vue";

import type { HDASummary } from "@/api";
import type { CompositeFileInfo } from "@/api/datatypes";
import { AUTO_EXTENSION, getUploadDatatypes } from "@/components/Upload/utils";
import { useConfig } from "@/composables/config";
import { useUserStore } from "@/stores/userStore";
import localize from "@/utils/localization";
import { orList } from "@/utils/strings";

import HelpText from "@/components/Help/HelpText.vue";
import DefaultBox from "@/components/Upload/DefaultBox.vue";

const Tabs = {
    create: 0,
    upload: 1,
};

type ExtensionDetails = {
    id: string;
    text: string;
    description: string | null;
    description_url: string | null;
    composite_files?: CompositeFileInfo[] | null;
    upload_warning?: string | null;
};

interface Props {
    oncancel: () => void;
    historyId: string;
    hideSourceItems: boolean;
    suggestedName?: string;
    renderExtensionsToggle?: boolean;
    extensions?: string[];
    extensionsToggle?: boolean;
    noItems?: boolean;
    collectionType?: string;
}

const props = withDefaults(defineProps<Props>(), {
    suggestedName: "",
    extensions: undefined,
    extensionsToggle: false,
});

const emit = defineEmits<{
    (e: "remove-extensions-toggle"): void;
    (e: "clicked-create", value: string): void;
    (e: "onUpdateHideSourceItems", value: boolean): void;
    (e: "on-update-datatype-toggle", value: "all" | "datatype" | "ext"): void;
    (e: "add-uploaded-files", value: HDASummary[]): void;
}>();

const isExpanded = ref(false);
const currentTab = ref(Tabs.create);
const collectionName = ref(props.suggestedName);
const localHideSourceItems = ref(props.hideSourceItems);
const listExtensions = ref<ExtensionDetails[]>([]);
const extensionsSet = ref(false);

const validInput = computed(() => {
    return collectionName.value.length > 0;
});

// If there are props.extensions, filter the list of extensions to only include those
const validExtensions = computed(() => {
    return listExtensions.value.filter((ext) => props.extensions?.includes(ext.id));
});

// Upload properties
const { config, isConfigLoaded } = useConfig();

const { currentUser } = storeToRefs(useUserStore());

const configOptions = computed(() =>
    isConfigLoaded.value
        ? {
              chunkUploadSize: config.value.chunk_upload_size,
              fileSourcesConfigured: config.value.file_sources_configured,
              ftpUploadSite: config.value.ftp_upload_site,
              defaultDbKey: config.value.default_genome || "",
              defaultExtension: config.value.default_extension || "",
          }
        : {}
);

const ftpUploadSite = computed(() =>
    currentUser.value && "id" in currentUser.value ? configOptions.value.ftpUploadSite : null
);

const defaultExtension = computed(() => {
    if (!configOptions.value || !extensionsSet.value) {
        return "auto";
    } else if (!props.extensions?.length) {
        return configOptions.value.defaultExtension || "auto";
    } else {
        return props.extensions[0];
    }
});

const shortWhatIsBeingCreated = computed<string>(() => {
    // plain language for what is being created
    if (props.collectionType === "list") {
        return "list";
    } else if (props.collectionType === "list:paired") {
        return "list of pairs";
    } else if (props.collectionType == "paired") {
        return "dataset pair";
    } else {
        return "collection";
    }
});

function addUploadedFiles(value: HDASummary[]) {
    // TODO: We really need to wait for each of these items to get `state = 'ok'`
    //       before we can add them to the collection.
    emit("add-uploaded-files", value);
}

function clickForHelp() {
    isExpanded.value = !isExpanded.value;
    return isExpanded.value;
}

function cancelCreate() {
    props.oncancel();
}

async function loadExtensions() {
    listExtensions.value = await getUploadDatatypes(false, AUTO_EXTENSION);
    extensionsSet.value = true;
}

loadExtensions();

watch(
    () => localHideSourceItems.value,
    () => {
        emit("onUpdateHideSourceItems", localHideSourceItems.value);
    }
);
</script>

<template>
    <BTabs v-model="currentTab" fill justified>
        <BTab class="collection-creator" :title="localize('Create Collection')">
            <div v-if="props.noItems">
                <BAlert variant="info" show>
                    {{ localize("No items available to create a collection.") }}
                    {{ localize("Exit and change your current history, or") }}
                    <BLink class="text-decoration-none" @click.stop.prevent="currentTab = Tabs.upload">
                        {{ localize("Upload some datasets.") }}
                    </BLink>
                </BAlert>
            </div>
            <div v-else>
                <div class="header flex-row no-flex">
                    <div class="main-help well clear" :class="{ expanded: isExpanded }">
                        <a
                            class="more-help"
                            href="javascript:void(0);"
                            role="button"
                            :title="localize('Expand or Close Help')"
                            @click="clickForHelp">
                            <div v-if="!isExpanded">
                                <FontAwesomeIcon :icon="faChevronDown" />
                                <span class="sr-only">{{ localize("Expand Help") }}</span>
                            </div>
                            <div v-else>
                                <FontAwesomeIcon :icon="faChevronUp" />
                                <span class="sr-only">{{ localize("Close Help") }}</span>
                            </div>
                        </a>

                        <div class="help-content">
                            <!-- each collection that extends this will add their own help content -->
                            <slot name="help-content"></slot>

                            <a
                                class="more-help"
                                href="javascript:void(0);"
                                role="button"
                                :title="localize('Expand or Close Help')"
                                @click="clickForHelp">
                                <span class="sr-only">{{ localize("Expand Help") }}</span>
                            </a>
                        </div>
                    </div>
                </div>

                <div class="middle flex-row flex-row-container">
                    <slot name="middle-content"></slot>
                </div>

                <div class="footer flex-row">
                    <div class="vertically-spaced">
                        <div class="d-flex align-items-center justify-content-between">
                            <BAlert v-if="extensions?.length" class="w-100 py-0" variant="secondary" show>
                                <HelpText
                                    uri="galaxy.collections.collectionBuilder.filteredExtensions"
                                    :text="localize('Filtered extensions: ')" />
                                <strong>{{ orList(extensions) }}</strong>
                            </BAlert>
                        </div>

                        <div class="d-flex align-items-center justify-content-between">
                            <BFormGroup class="inputs-form-group">
                                <BFormCheckbox
                                    v-if="renderExtensionsToggle"
                                    name="remove-extensions"
                                    switch
                                    :checked="extensionsToggle"
                                    @input="emit('remove-extensions-toggle')">
                                    {{ localize("Remove file extensions?") }}
                                </BFormCheckbox>

                                <div data-description="hide original elements">
                                    <BFormCheckbox v-model="localHideSourceItems" name="hide-originals" switch>
                                        <HelpText
                                            uri="galaxy.collections.collectionBuilder.hideOriginalElements"
                                            :text="localize('Hide original elements')" />
                                    </BFormCheckbox>
                                </div>
                            </BFormGroup>

                            <BFormGroup
                                class="flex-gapx-1 d-flex align-items-center w-50 inputs-form-group"
                                :label="localize('Name:')"
                                label-for="collection-name">
                                <BFormInput
                                    id="collection-name"
                                    v-model="collectionName"
                                    class="collection-name"
                                    :placeholder="localize('Enter a name for your new ' + shortWhatIsBeingCreated)"
                                    size="sm"
                                    required
                                    :state="!collectionName ? false : null" />
                            </BFormGroup>
                        </div>
                    </div>

                    <div class="actions vertically-spaced d-flex justify-content-between">
                        <BButton tabindex="-1" @click="cancelCreate">
                            {{ localize("Cancel") }}
                        </BButton>

                        <BButton
                            class="create-collection"
                            variant="primary"
                            :disabled="!validInput"
                            @click="emit('clicked-create', collectionName)">
                            {{ localize("Create " + shortWhatIsBeingCreated) }}
                        </BButton>
                    </div>
                </div>
            </div>
        </BTab>
        <BTab>
            <template v-slot:title>
                <FontAwesomeIcon :icon="faUpload" fixed-width />
                <span>{{ localize("Upload Files to Add to Collection") }}</span>
            </template>
            <!-- TODO: This is incomplete; need to return uploadValues to parent -->
            <DefaultBox
                v-if="configOptions && extensionsSet"
                :chunk-upload-size="configOptions.chunkUploadSize"
                :default-db-key="configOptions.defaultDbKey"
                :default-extension="defaultExtension"
                :effective-extensions="props.extensions?.length ? validExtensions : listExtensions"
                :file-sources-configured="configOptions.fileSourcesConfigured"
                :ftp-upload-site="ftpUploadSite"
                :has-callback="false"
                :history-id="historyId"
                :list-db-keys="[]"
                disable-footer
                emit-uploaded
                @uploaded="addUploadedFiles"
                @dismiss="currentTab = Tabs.create">
                <template v-slot:footer>
                    <div class="d-flex align-items-center justify-content-between mt-2">
                        <BAlert v-if="extensions?.length" class="w-100 py-0" variant="secondary" show>
                            <HelpText
                                uri="galaxy.collections.collectionBuilder.requiredUploadExtensions"
                                :text="localize('Required extensions: ')" />
                            <strong>{{ orList(extensions) }}</strong>
                        </BAlert>
                    </div>
                </template>
                <template v-slot:emit-btn-txt>
                    <FontAwesomeIcon :icon="faPlus" fixed-width />
                    {{ localize("Add Uploaded") }}
                </template>
            </DefaultBox>
        </BTab>
    </BTabs>
</template>

<style lang="scss">
$fa-font-path: "../../../../node_modules/@fortawesome/fontawesome-free/webfonts/";
@import "~@fortawesome/fontawesome-free/scss/_variables";
@import "~@fortawesome/fontawesome-free/scss/solid";
@import "~@fortawesome/fontawesome-free/scss/fontawesome";
@import "~@fortawesome/fontawesome-free/scss/brands";
.collection-creator {
    height: 100%;
    overflow: hidden;
    // ------------------------------------------------------------------------ general
    ol,
    li {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    > *:not(.popover) {
        padding: 0px 8px 0px 8px;
    }
    .btn {
        border-color: #bfbfbf;
    }
    .vertically-spaced {
        margin-top: 8px;
    }
    .scroll-container {
        overflow: auto;
        //overflow-y: scroll;
    }
    .truncate {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .empty-message {
        color: grey;
        font-style: italic;
    }
    // ------------------------------------------------------------------------ flex
    &.flex-row-container,
    .flex-row-container,
    .flex-column-container {
        display: -webkit-box;
        display: -webkit-flex;
        display: -ms-flexbox;
        display: flex;
        -webkit-align-items: stretch;
        -ms-align-items: stretch;
        align-items: stretch;
        -webkit-align-content: stretch;
        -ms-align-content: stretch;
        align-content: stretch;
    }
    // a series of vertical elements that will expand to fill available space
    // Tried to drop the important here but we have divs with classes of the form:
    //    flex-column-container scroll-container flex-row
    // and flex-row specifies a row direction with important. I was unable to separate
    // this into two separate divs and get the styling right but that'd probably be a
    // better way to go longer term.
    &.flex-row-container,
    .flex-row-container {
        -webkit-flex-direction: column !important;
        -ms-flex-direction: column !important;
        flex-direction: column !important;
    }
    .flex-row {
        -webkit-flex: 1 auto;
        -ms-flex: 1 auto;
        flex: 1 0 auto;
    }
    .flex-row.no-flex {
        -webkit-flex: 0 auto;
        -ms-flex: 0 auto;
        flex: 0 0 auto;
    }
    // a series of horizontal elements that will expand to fill available space
    .flex-column-container {
        -webkit-flex-direction: row;
        -ms-flex-direction: row;
        flex-direction: row;
    }
    .flex-column {
        -webkit-flex: 1 auto;
        -ms-flex: 1 auto;
        flex: 1 1 auto;
    }
    .flex-column.no-flex {
        -webkit-flex: 0 auto;
        -ms-flex: 0 auto;
        flex: 0 0 auto;
    }
    // ------------------------------------------------------------------------ sub-components
    .choose-filters {
        .help {
            margin-bottom: 2px;
            font-size: 90%;
            color: grey;
        }
        button {
            width: 100%;
            margin-top: 2px;
        }
    }
    .header .alert {
        display: none;
        li {
            list-style: circle;
            margin-left: 32px;
        }
    }
    // ------------------------------------------------------------------------ columns
    .column {
        width: 30%;
    }
    .column-title {
        height: 22px;
        line-height: 22px;
        overflow: hidden;
        &:hover {
            text-decoration: underline;
            cursor: pointer;
        }
        .title {
            font-weight: bold;
        }
        .title-info {
            color: grey;
            &:before {
                content: " - ";
            }
        }
    }
    // ------------------------------------------------------------------------ header
    .header {
        .main-help {
            margin-bottom: 17px;
            overflow: hidden;
            padding: 15px;
            &:not(.expanded) {
                // chosen to match alert - dependent on line height and .alert padding
                max-height: 49px;
                .help-content {
                    p:first-child {
                        overflow: hidden;
                        white-space: nowrap;
                        text-overflow: ellipsis;
                    }
                    > *:not(:first-child) {
                        display: none;
                    }
                }
            }
            &.expanded {
                max-height: none;
            }
            .help-content {
                i {
                    cursor: help;
                    border-bottom: 1px dotted grey;
                    font-style: normal;
                    //font-weight: bold;
                    //text-decoration: underline;
                    //text-decoration-style: dashed;
                }
                ul,
                li {
                    list-style: circle;
                    margin-left: 16px;
                }
                .scss-help {
                    display: inline-block;
                    width: 100%;
                    text-align: right;
                }
            }
            .more-help {
                //display: inline-block;
                float: right;
            }
        }
        .column-headers {
            .column-header {
                //min-height: 45px;
                .unpaired-filter {
                    width: 100%;
                    .search-query {
                        width: 100%;
                        height: 22px;
                    }
                }
            }
        }
        .paired-column a:not(:last-child) {
            margin-right: 8px;
        }
        .reverse-column .column-title {
            text-align: right;
        }
    }
    // ------------------------------------------------------------------------ middle
    // ---- all
    // macro
    .flex-bordered-vertically {
        // huh! - giving these any static height will pull them in
        height: 0;
        // NOT setting the above will give a full-height page
        border: 1px solid lightgrey;
        border-width: 1px 0 1px 0;
    }
    .element-drop-placeholder {
        width: 60px;
        height: 3px;
        margin: 2px 0px 0px 14px;
        background: black;
        &:before {
            @extend .fas;
            float: left;
            font-size: 120%;
            margin: -9px 0px 0px -8px;
            content: fa-content($fa-var-caret-right);
        }
        &:last-child {
            margin-bottom: 8px;
        }
    }
    // ------------------------------------------------------------------------ footer
    .footer {
        .inputs-form-group > div {
            width: 100%;
            display: flex;
            align-items: center;
            column-gap: 0.25rem;
        }
        .actions {
            .other-options > * {
                // do not display the links to create other collections yet
                display: none;
                margin-left: 4px;
            }
        }
        padding-bottom: 8px;
    }
}
</style>
