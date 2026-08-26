<template>
  <div class="MatcLibsPage" :style="{height: pageHeight}">

    <!-- ==================== List mode (#/libs.html) ==================== -->
    <div v-if="!isDetail" class="MatcLibsList">
      <div class="MatcLibsHeader">
        <h2 class="MatcLibsTitle">{{ t('library.title') }}</h2>
        <a class="MatcButton MatcButtonPrimary MatcRoundButton" @click="showCreateDialog" ref="createBtn">
          <QIcon icon="Plus"/>
          <span>{{ t('library.create.title') }}</span>
        </a>
      </div>
      <div class="MatcLibsContent">
        <div v-if="loading" class="MatcLibsHint">{{ t('library.loading') }}</div>
        <div v-else-if="libs.length === 0" class="MatcLibsHint">{{ t('library.empty') }}</div>
        <template v-else>
          <a v-for="lib in libs" :key="lib.id" class="MatcLibsItem" :href="'#/libs/' + lib.id + '.html'">
            <div class="MatcLibsItemMain">
              <div class="MatcLibsItemNameRow">
                <span class="MatcLibsItemName">{{ lib.name }}</span>
                <span v-if="lib.isPublic" class="MatcLibsBadge MatcLibsBadgePublic">{{ t('library.create.is-public') }}</span>
              </div>
              <div v-if="lib.description" class="MatcLibsItemDesc">{{ lib.description }}</div>
            </div>
            <div class="MatcLibsItemMeta" :title="t('library.team.title')">
              <span class="MatcLibsMetaCount" v-if="memberCounts[lib.id] !== undefined">{{ memberCounts[lib.id] }}</span>
            </div>
          </a>
        </template>
      </div>
    </div>

    <!-- ==================== Detail mode (#/libs/:id.html) ==================== -->
    <div v-else class="MatcLibsDetail">
      <div class="MatcLibsHeader">
        <a class="MatcLibsBack MatcLinkButton" href="#/libs.html">
          <span class="MatcLibsBackArrow">&lt;</span> {{ t('btn.back') }}
        </a>
        <h2 class="MatcLibsTitle">{{ lib ? lib.name : t('library.title') }}</h2>
        <a v-if="isOwner" class="MatcButton MatcButtonDanger MatcRoundButton" @click="confirmDeleteLib" ref="deleteBtn">
          {{ t('library.delete.title') }}
        </a>
      </div>

      <div class="MatcLibsContent">
        <div v-if="loading" class="MatcLibsHint">{{ t('library.loading') }}</div>
        <template v-else-if="lib">
          <!-- Library info (editable) -->
          <section class="MatcLibsSection">
            <div class="MatcLibsField">
              <label class="MatcLibsFieldLabel">{{ t('library.create.name') }}</label>
              <input type="text" class="form-control MatcLibsInput" v-model="editForm.name"
                :disabled="!canWrite" @keyup.enter="onNameEnter" @blur="saveInfo"/>
            </div>
            <div class="MatcLibsField">
              <label class="MatcLibsFieldLabel">{{ t('library.create.description') }}</label>
              <textarea class="form-control MatcLibsInput MatcLibsTextArea" v-model="editForm.description"
                :disabled="!canWrite" @blur="saveInfo"></textarea>
            </div>
            <div class="MatcLibsField MatcLibsFieldRow">
              <label class="MatcLibsFieldLabel">{{ t('library.create.is-public') }}</label>
              <label class="MatcSwitch">
                <input type="checkbox" v-model="editForm.isPublic" :disabled="!canWrite" @change="saveInfo"/>
                <span class="MatcSwitchSlider"></span>
              </label>
            </div>
          </section>

          <!-- Content preview (read only) -->
          <section class="MatcLibsSection">
            <h3 class="MatcLibsSectionTitle">{{ t('library.content') }}</h3>
            <div v-if="contentStats.length === 0" class="MatcLibsHint">{{ t('library.content-empty') }}</div>
            <div v-else class="MatcLibsContentGrid">
              <template v-for="s in contentStats" :key="s.key">
                <div class="MatcLibsContentItem">
                  <div class="MatcLibsContentItemHead">
                    <span class="MatcLibsContentItemName">{{ t('library.' + s.key) }}</span>
                    <span class="MatcLibsBadge MatcLibsBadgeCount">{{ s.count }}</span>
                  </div>
                  <div class="MatcLibsContentItemNames" v-if="s.names.length > 0">
                    <span v-for="(n, i) in s.names" :key="i" class="MatcLibsContentName">{{ n }}</span>
                    <span v-if="s.more > 0" class="MatcLibsContentNameMore">+{{ s.more }}</span>
                  </div>
                </div>
              </template>
            </div>
          </section>

          <!-- Members -->
          <section class="MatcLibsSection">
            <div class="MatcLibsSectionHeader">
              <h3 class="MatcLibsSectionTitle">{{ t('library.team.title') }}</h3>
              <a v-if="canWrite" class="MatcButton MatcButtonXS MatcButtonSecondary" @click="showAddMemberDialog" ref="addMemberBtn">
                {{ t('library.team.add') }}
              </a>
            </div>
            <div v-if="team.length === 0" class="MatcLibsHint">{{ t('library.team.empty') }}</div>
            <div v-else class="MatcLibsTeam">
              <template v-for="member in team" :key="member._id || member.id">
                <div class="MatcLibsMember">
                  <div class="MatcLibsMemberInfo">
                    <div class="MatcLibsMemberName">
                      {{ memberName(member) }}
                      <span v-if="isMe(member)" class="MatcLibsMemberSelf">({{ t('library.self') }})</span>
                    </div>
                    <div class="MatcLibsMemberEmail">{{ member.email }}</div>
                  </div>
                  <div class="MatcLibsMemberPerm">
                    <select v-if="canEditMember(member)" class="form-control MatcLibsPermSelect"
                      :value="member.permission" @change="onPermissionChange(member, $event)">
                      <option :value="1">{{ t('library.permission.viewer') }}</option>
                      <option :value="2">{{ t('library.permission.editor') }}</option>
                    </select>
                    <span v-else :class="['MatcLibsBadge', permBadgeClass(member)]">{{ permLabel(member) }}</span>
                  </div>
                  <a v-if="canEditMember(member) && !isMe(member)"
                    class="MatcLibsMemberRemove MatcLinkButton" @click="confirmRemoveMember(member, $event)">
                    {{ t('library.team.remove') }}
                  </a>
                </div>
              </template>
            </div>
          </section>
        </template>
        <div v-else class="MatcLibsHint">{{ t('library.detail.not-found') }}</div>
      </div>
    </div>

    <!-- ==================== Dialogs ==================== -->
    <ZoomDialog ref="createDialog" @close="onCreateDialogClose">
      <div class="MatcDialog MatcResizeDialog MatcLibsDialog">
        <h2 class="MatcDialogHeader MatcLibsDialogHeader">{{ t('library.create.title') }}</h2>
        <div class="form-group">
          <label>{{ t('library.create.name') }} *</label>
          <input type="text" class="form-control" v-model="createForm.name" ref="createName" :placeholder="t('library.create.name-placeholder')"/>
          <div class="MatcErrorLabel">{{ createError }}</div>
        </div>
        <div class="form-group">
          <label>{{ t('library.create.description') }}</label>
          <textarea class="form-control MatcLibsTextArea" v-model="createForm.description" :placeholder="t('library.create.description-placeholder')"></textarea>
        </div>
        <div class="form-group MatcLibsFormRow">
          <label>{{ t('library.create.is-public') }}</label>
          <label class="MatcSwitch">
            <input type="checkbox" v-model="createForm.isPublic"/>
            <span class="MatcSwitchSlider"></span>
          </label>
        </div>
        <div class="MatcButtonBar">
          <a class="MatcButton MatcButtonPrimary" @click="createLib">{{ t('library.create.submit') }}</a>
          <a class="MatcLinkButton" @click="closeCreateDialog">{{ t('library.create.cancel') }}</a>
        </div>
      </div>
    </ZoomDialog>

    <ZoomDialog ref="addMemberDialog" @close="closeAddMemberDialogReset">
      <div class="MatcDialog MatcResizeDialog MatcLibsDialog">
        <h2 class="MatcDialogHeader MatcLibsDialogHeader">{{ t('library.team.add') }}</h2>
        <div class="form-group">
          <label>{{ t('library.team.email') }}</label>
          <input type="text" class="form-control" v-model="addForm.email" ref="addEmail" :placeholder="t('library.team.email-placeholder')"/>
        </div>
        <div class="form-group">
          <label>{{ t('library.team.permission') }}</label>
          <select class="form-control" v-model="addForm.permission">
            <option :value="1">{{ t('library.permission.viewer') }}</option>
            <option :value="2">{{ t('library.permission.editor') }}</option>
          </select>
        </div>
        <div class="MatcButtonBar">
          <a class="MatcButton MatcButtonPrimary" @click="addMember">{{ t('library.team.add-submit') }}</a>
          <a class="MatcLinkButton" @click="closeAddMemberDialog">{{ t('btn.cancel') }}</a>
        </div>
      </div>
    </ZoomDialog>

    <ZoomDialog ref="confirmDialog" @close="onConfirmDialogClose">
      <div class="MatcDialog MatcDeleteDialog">
        <h3 class="title is-4">{{ confirm.title }}</h3>
        <p class="MatcMarginBottomXL">{{ confirm.message }}</p>
        <div class="MatcButtonBar">
          <a class="MatcButton MatcButtonDanger" @click="runConfirm">{{ confirm.okLabel }}</a>
          <a class="MatcLinkButton" @click="closeConfirm">{{ t('btn.cancel') }}</a>
        </div>
      </div>
    </ZoomDialog>

  </div>
</template>

<style lang="scss">
  @import "../../style/matc.scss";
  @import "../../style/studio.scss";
</style>

<style lang="scss" scoped>
  .MatcLibsPage {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    max-width: 1152px;
    margin: 0 auto;
    padding: 0 24px 24px;
    min-height: 480px;
  }

  .MatcLibsList,
  .MatcLibsDetail {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
  }

  .MatcLibsHeader {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    flex: 0 0 auto;

    .MatcLibsTitle {
      flex: 1;
      margin: 0;
      font-size: 22px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .MatcLibsBack {
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;

    .MatcLibsBackArrow {
      font-size: 14px;
      line-height: 1;
    }
  }

  .MatcLibsContent {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: 4px 2px 16px;
  }

  .MatcLibsHint {
    padding: 24px 8px;
    color: #999;
    font-size: 14px;
  }

  /* ------ list ------ */
  .MatcLibsItem {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    margin-bottom: 6px;
    border: 1px solid #e2e2e2;
    border-radius: 8px;
    background: #fff;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;

    &:hover {
      border-color: #4a90e2;
      box-shadow: 0 1px 6px rgba(74, 144, 226, 0.15);
    }

    .MatcLibsItemMain {
      flex: 1;
      min-width: 0;
    }

    .MatcLibsItemNameRow {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .MatcLibsItemName {
      font-size: 15px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .MatcLibsItemDesc {
      font-size: 13px;
      color: #888;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .MatcLibsItemMeta {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
    }

    .MatcLibsMetaCount {
      min-width: 24px;
      text-align: center;
      padding: 2px 6px;
      border-radius: 10px;
      background: #f0f0f0;
      color: #666;
      font-size: 12px;
    }
  }

  /* ------ detail ------ */
  .MatcLibsSection {
    padding: 12px 0;
    border-top: 1px solid #eee;

    &:first-child {
      border-top: none;
    }
  }

  .MatcLibsSectionHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .MatcLibsSectionTitle {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #555;
  }

  .MatcLibsSectionHeader .MatcLibsSectionTitle {
    margin: 0;
  }

  .MatcLibsField {
    margin-bottom: 8px;

    .MatcLibsInput {
      font-size: 14px;
    }
  }

  .MatcLibsFieldRow {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .MatcLibsFieldLabel {
    display: block;
    font-size: 12px;
    color: #777;
    margin-bottom: 3px;
  }

  .MatcLibsTextArea {
    resize: vertical;
    min-height: 56px;
  }

  .MatcLibsFormRow {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;

    label {
      margin-bottom: 0;
    }
  }

  /* content grid */
  .MatcLibsContentGrid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
  }

  .MatcLibsContentItem {
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    padding: 8px 10px;
    background: #fff;

    .MatcLibsContentItemHead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .MatcLibsContentItemName {
      font-size: 13px;
      font-weight: 500;
    }

    .MatcLibsContentItemNames {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 6px;
    }

    .MatcLibsContentName {
      font-size: 12px;
      color: #777;
      background: #f5f5f5;
      border-radius: 4px;
      padding: 1px 6px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .MatcLibsContentNameMore {
      font-size: 12px;
      color: #999;
    }
  }

  /* badges */
  .MatcLibsBadge {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 12px;
    line-height: 1.6;
    white-space: nowrap;
  }

  .MatcLibsBadgePublic {
    background: #e8f4fd;
    color: #2d7fc1;
  }

  .MatcLibsBadgeCount {
    background: #f0f0f0;
    color: #666;
  }

  .MatcLibsBadgeOwner {
    background: #fdeaea;
    color: #c05050;
  }

  .MatcLibsBadgeEditor {
    background: #e8f4fd;
    color: #2d7fc1;
  }

  .MatcLibsBadgeViewer {
    background: #f0f0f0;
    color: #777;
  }

  /* members */
  .MatcLibsTeam {
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    background: #fff;
  }

  .MatcLibsMember {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-bottom: 1px solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }

    .MatcLibsMemberInfo {
      flex: 1;
      min-width: 0;
    }

    .MatcLibsMemberName {
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      .MatcLibsMemberSelf {
        font-weight: 400;
        color: #999;
        font-size: 12px;
      }
    }

    .MatcLibsMemberEmail {
      font-size: 12px;
      color: #888;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .MatcLibsMemberPerm {
      flex: 0 0 auto;
      min-width: 96px;

      .MatcLibsPermSelect {
        font-size: 13px;
        padding: 2px 6px;
        height: 30px;
      }
    }

    .MatcLibsMemberRemove {
      flex: 0 0 auto;
      font-size: 12px;
      height: 28px;
      padding: 0 8px;
    }
  }

  /* dialog */
  .MatcLibsDialog {
    .MatcLibsDialogHeader {
      margin-bottom: 12px;
    }

    .form-group {
      margin-bottom: 10px;

      label {
        font-size: 13px;
        margin-bottom: 3px;
      }
    }

    .MatcButtonBar {
      margin-top: 18px;
    }
  }

  /* switch */
  .MatcSwitch {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
    margin: 0;

    input {
      opacity: 0;
      width: 0;
      height: 0;

      &:checked + .MatcSwitchSlider {
        background: #4a90e2;

        &:before {
          transform: translateX(16px);
        }
      }

      &:disabled + .MatcSwitchSlider {
        opacity: 0.5;
        cursor: default;
      }
    }

    .MatcSwitchSlider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #ccc;
      border-radius: 20px;
      transition: 0.2s;

      &:before {
        content: "";
        position: absolute;
        height: 16px;
        width: 16px;
        left: 2px;
        top: 2px;
        background: #fff;
        border-radius: 50%;
        transition: 0.2s;
      }
    }
  }
</style>

<script>
import Logger from "common/Logger";
import DojoWidget from "dojo/DojoWidget";
import Services from "services/Services";
import ZoomDialog from "common/ZoomDialog";
import QIcon from "page/QIcon";

/**
 * Permission values are intentionally different from the app permission
 * model: 3 = Owner, 2 = Editor, 1 = Viewer. Do NOT reuse the app PERMISSIONS.
 */
const LIB_PERMISSIONS = {
  READ: 1,
  WRITE: 2,
  OWNER: 3
};

/**
 * Fallback texts for keys that do not exist in src/nls (the official
 * library.* keys are provided by the service task; only a few UI strings
 * like content preview field names and a couple of dialogs are local).
 * $t is used whenever the key exists, otherwise these defaults keep the
 * UI readable (and avoid showing raw keys).
 */
const LIB_L10N = {
  "library.name-required": "Name is required",
  "library.self": "you",
  "library.team.empty": "No members yet",
  "library.team.email": "Email",
  "library.team.exists": "This user is already a member of the library.",
  "library.team.remove-confirm-title": "Remove Member",
  "library.team.remove-confirm-message": "Do you want to remove \u201c{name}\u201d from this library?",
  "library.error-service": "Library service is not available yet",
  "library.error-team": "Could not load members",
  "library.error-permission": "Could not update permission",
  "library.content": "Content",
  "library.content-empty": "This library has no content yet",
  "library.widgets": "Widgets",
  "library.screens": "Screens",
  "library.groups": "Groups",
  "library.templates": "Templates",
  "library.grid": "Grid",
  "library.lines": "Lines"
};

export default {
  name: "Library",
  mixins: [DojoWidget],
  components: {
    "ZoomDialog": ZoomDialog,
    "QIcon": QIcon
  },
  data: function () {
    return {
      libID: "",
      loading: false,
      libs: [],
      lib: null,
      team: [],
      memberCounts: {},
      editForm: {
        name: "",
        description: "",
        isPublic: false
      },
      createForm: {
        name: "",
        description: "",
        isPublic: false
      },
      createError: "",
      addForm: {
        email: "",
        permission: LIB_PERMISSIONS.READ
      },
      confirm: {
        title: "",
        message: "",
        okLabel: "",
        onOk: null
      },
      user: {}
    };
  },
  computed: {
    isDetail() {
      return !!this.libID;
    },
    hasHeader() {
      return !!(this.$route.meta && this.$route.meta.hasHeader);
    },
    pageHeight() {
      return this.hasHeader ? "calc(100vh - 124px)" : "calc(100vh - 48px)";
    },
    myMember() {
      const uid = this.currentUserId();
      if (!uid) {
        return null;
      }
      return this.team.find(m => String(m._id || m.id) === String(uid)) || null;
    },
    isOwner() {
      return !!this.myMember && this.myMember.permission === LIB_PERMISSIONS.OWNER;
    },
    canWrite() {
      return !!this.myMember && this.myMember.permission >= LIB_PERMISSIONS.WRITE;
    },
    contentStats() {
      if (!this.lib) {
        return [];
      }
      const fields = ["widgets", "screens", "groups", "templates", "grid", "lines"];
      const stats = [];
      fields.forEach(key => {
        const raw = this.lib[key];
        if (raw === undefined || raw === null) {
          return;
        }
        const arr = Array.isArray(raw) ? raw : Object.values(raw);
        const names = [];
        for (let i = 0; i < arr.length && names.length < 8; i++) {
          const item = arr[i];
          const n = item && (item.name || item.id || item._id);
          if (n !== undefined && n !== null && n !== "") {
            names.push(String(n));
          }
        }
        stats.push({ key: key, count: arr.length, names: names, more: Math.max(0, arr.length - names.length) });
      });
      return stats;
    }
  },
  watch: {
    $route() {
      this.initRoute();
    }
  },
  methods: {
    /**
     * i18n with fallback: use $t when the key is present, otherwise fall
     * back to the local English defaults (library.* keys land with the
     * service task).
     */
    t(key, params) {
      let msg = null;
      try {
        if (this.$i18n && typeof this.$i18n.te === "function" && this.$i18n.te(key)) {
          msg = this.$t(key, params);
        }
      } catch (e) {
        msg = null;
      }
      if (msg == null || msg === key) {
        msg = LIB_L10N[key];
      }
      if (typeof msg === "string" && params) {
        for (const k of Object.keys(params)) {
          msg = msg.replace(new RegExp("\\{" + k + "\\}", "g"), params[k]);
        }
      }
      return msg || key;
    },
    currentUserId() {
      const u = Services.getUserService().getUser();
      return u && u.id && String(u.id) !== "-1" ? u.id : null;
    },
    getService() {
      if (typeof Services.getLibraryService !== "function") {
        if (!this._serviceMissingShown) {
          this._serviceMissingShown = true;
          this.showError(this.t("library.error-service"));
        }
        return null;
      }
      if (!this._libService) {
        this._libService = Services.getLibraryService();
      }
      return this._libService;
    },
    canEditMember(member) {
      return this.canWrite && !!member && member.permission !== LIB_PERMISSIONS.OWNER;
    },
    permLabel(member) {
      const p = member && member.permission;
      if (p === LIB_PERMISSIONS.OWNER) {
        return this.t("library.permission.owner");
      }
      if (p === LIB_PERMISSIONS.WRITE) {
        return this.t("library.permission.editor");
      }
      return this.t("library.permission.viewer");
    },
    permBadgeClass(member) {
      const p = member && member.permission;
      if (p === LIB_PERMISSIONS.OWNER) {
        return "MatcLibsBadgeOwner";
      }
      if (p === LIB_PERMISSIONS.WRITE) {
        return "MatcLibsBadgeEditor";
      }
      return "MatcLibsBadgeViewer";
    },
    memberName(member) {
      if (!member) {
        return "";
      }
      const n = ((member.name || "") + " " + (member.lastname || "")).trim();
      return n || member.email || "";
    },
    isMe(member) {
      const uid = this.currentUserId();
      return !!uid && String(member._id || member.id) === String(uid);
    },
    syncEditForm() {
      const lib = this.lib || {};
      this.editForm = {
        name: lib.name || "",
        description: lib.description || "",
        isPublic: !!lib.isPublic
      };
    },
    async initRoute() {
      const id = this.$route.params.id || "";
      if (id === this.libID && (this.libs.length > 0 || this.lib)) {
        return;
      }
      this.libID = id;
      if (id) {
        await this.loadLib();
      } else {
        await this.loadLibs();
      }
    },
    async loadLibs() {
      const svc = this.getService();
      if (!svc) {
        return;
      }
      this.loading = true;
      this.libs = [];
      this.memberCounts = {};
      try {
        const found = await svc.findLibs();
        this.libs = Array.isArray(found) ? found : [];
        this.loadMemberCounts();
      } catch (e) {
        this.showError(this.t("library.load-error"));
      } finally {
        this.loading = false;
      }
    },
    async loadMemberCounts() {
      const svc = this.getService();
      if (!svc) {
        return;
      }
      const counts = {};
      await Promise.all(this.libs.map(async lib => {
        try {
          const team = await svc.findTeam(lib.id);
          counts[lib.id] = Array.isArray(team) ? team.length : 0;
        } catch (e) {
          // leave undefined -> the count is not displayed
        }
      }));
      this.memberCounts = counts;
    },
    async loadLib() {
      const svc = this.getService();
      if (!svc) {
        return;
      }
      this.loading = true;
      this.lib = null;
      this.team = [];
      try {
        this.lib = await svc.findLib(this.libID);
        this.syncEditForm();
        this.loadTeam();
      } catch (e) {
        this.showError(this.t("library.detail.not-found"));
      } finally {
        this.loading = false;
      }
    },
    async loadTeam() {
      const svc = this.getService();
      if (!svc) {
        return;
      }
      try {
        const found = await svc.findTeam(this.libID);
        this.team = Array.isArray(found) ? found : [];
      } catch (e) {
        this.showError(this.t("library.error-team"));
      }
    },
    /* ------ create ------ */
    showCreateDialog(e) {
      this.createError = "";
      this.$refs.createDialog.show(e.target);
      setTimeout(() => {
        if (this.$refs.createName) {
          this.$refs.createName.focus();
        }
      }, 200);
    },
    closeCreateDialog() {
      this.$refs.createDialog.close();
    },
    onCreateDialogClose() {
      this.createError = "";
      this.createForm = { name: "", description: "", isPublic: false };
    },
    async createLib() {
      this.createError = "";
      if (!this.createForm.name) {
        this.$refs.createDialog.shake();
        this.createError = this.t("library.name-required");
        return;
      }
      const svc = this.getService();
      if (!svc) {
        return;
      }
      try {
        await svc.createLib(
          this.createForm.name,
          this.createForm.description,
          !!this.createForm.isPublic
        );
        this.closeCreateDialog();
        await this.loadLibs();
        this.showSuccess(this.t("library.create.success"));
      } catch (e) {
        this.showError(this.t("library.create.error"));
      }
    },
    /* ------ info update ------ */
    onNameEnter(e) {
      if (e && e.target) {
        e.target.blur();
      }
    },
    async saveInfo() {
      if (!this.lib || !this.canWrite) {
        return;
      }
      if (!this.editForm.name) {
        this.syncEditForm();
        this.showError(this.t("library.name-required"));
        return;
      }
      const svc = this.getService();
      if (!svc) {
        return;
      }
      try {
        await svc.updateLib(this.libID, {
          name: this.editForm.name,
          description: this.editForm.description,
          isPublic: !!this.editForm.isPublic
        });
        this.lib.name = this.editForm.name;
        this.lib.description = this.editForm.description;
        this.lib.isPublic = !!this.editForm.isPublic;
        this.showSuccess(this.t("library.update-success"));
      } catch (e) {
        this.syncEditForm();
        this.showError(this.t("library.update-error"));
      }
    },
    /* ------ members ------ */
    showAddMemberDialog(e) {
      this.$refs.addMemberDialog.show(e.target);
      setTimeout(() => {
        if (this.$refs.addEmail) {
          this.$refs.addEmail.focus();
        }
      }, 200);
    },
    closeAddMemberDialog() {
      this.$refs.addMemberDialog.close();
    },
    closeAddMemberDialogReset() {
      this.addForm = { email: "", permission: LIB_PERMISSIONS.READ };
    },
    async addMember() {
      if (!this.addForm.email) {
        this.showError(this.t("library.team.email-placeholder"));
        return;
      }
      const newEmail = String(this.addForm.email).trim().toLowerCase();
      const alreadyMember = (this.team || []).some(
        (m) => String((m && m.email) || "").trim().toLowerCase() === newEmail
      );
      if (alreadyMember) {
        this.showError(this.t("library.team.exists"));
        return;
      }
      const svc = this.getService();
      if (!svc) {
        return;
      }
      try {
        await svc.addTeam(this.libID, this.addForm.email, parseInt(this.addForm.permission, 10));
        this.closeAddMemberDialog();
        await this.loadTeam();
        this.showSuccess(this.t("library.team.add-success"));
      } catch (e) {
        this.showError(this.t("library.team.add-error"));
      }
    },
    async onPermissionChange(member, e) {
      const permission = parseInt(e.target.value, 10);
      const svc = this.getService();
      if (!svc) {
        return;
      }
      try {
        await svc.updateTeam(this.libID, member._id || member.id, permission);
        member.permission = permission;
        this.showSuccess(this.t("library.team.update-success"));
      } catch (err) {
        this.showError(this.t("library.error-permission"));
        this.loadTeam();
      }
    },
    confirmRemoveMember(member, e) {
      this.openConfirm(
        e,
        this.t("library.team.remove-confirm-title"),
        this.t("library.team.remove-confirm-message", { name: this.memberName(member) }),
        this.t("library.team.remove"),
        () => this.removeMember(member)
      );
    },
    async removeMember(member) {
      const svc = this.getService();
      if (!svc) {
        return;
      }
      try {
        await svc.removeTeam(this.libID, member._id || member.id);
        this.showSuccess(this.t("library.team.remove-success"));
        await this.loadTeam();
      } catch (e) {
        this.showError(this.t("library.team.remove-error"));
      }
    },
    /* ------ delete ------ */
    confirmDeleteLib(e) {
      const name = this.lib ? this.lib.name : "";
      this.openConfirm(
        e,
        this.t("library.delete.title"),
        this.t("library.delete.confirm", { name: name }),
        this.t("library.delete.title"),
        () => this.deleteLib()
      );
    },
    async deleteLib() {
      const svc = this.getService();
      if (!svc) {
        return;
      }
      try {
        await svc.deleteLib(this.libID);
        this.showSuccess(this.t("library.delete.success"));
        location.hash = "#/libs.html";
      } catch (e) {
        this.showError(this.t("library.delete.error"));
      }
    },
    /* ------ confirm dialog ------ */
    openConfirm(e, title, message, okLabel, onOk) {
      this.confirm = {
        title: title,
        message: message,
        okLabel: okLabel,
        onOk: onOk
      };
      this.$refs.confirmDialog.show(e.target);
    },
    closeConfirm() {
      this.$refs.confirmDialog.close();
    },
    onConfirmDialogClose() {
      this.confirm = { title: "", message: "", okLabel: "", onOk: null };
    },
    runConfirm() {
      const onOk = this.confirm.onOk;
      this.closeConfirm();
      if (onOk) {
        onOk();
      }
    }
  },
  async mounted() {
    this.logger = new Logger("Library");
    const user = Services.getUserService().getUser();
    if (user) {
      this.user = user;
    }
    this.initRoute();
    this.logger.info("mounted", "enter > ", this.$route.params.id);
  }
};
</script>
