/* ============================================================
   ProfileDialogView — In-App User Profile & Avatar Editor Modal
   
   Allows the user to customize their profile name, handle/email,
   and upload a profile picture or paste an avatar URL.
   ============================================================ */

import { el } from "../../shared/dom.js";
import { icon } from "../../shared/icons.js";

export class ProfileDialogView {
  constructor({ useCases, toast, events } = {}) {
    this.useCases = useCases;
    this.toast = toast;
    this.events = events;

    this.root = null;
    this.overlay = null;
    this.dialog = null;
    this.escHandler = null;
    this.onSave = null;
  }

  /**
   * Open the profile editor dialog.
   * @param {Object} currentProfile
   * @param {string} currentProfile.name
   * @param {string} currentProfile.email
   * @param {string} currentProfile.avatarUrl
   * @param {Function} [onSave]
   */
  open(currentProfile = {}, onSave = null) {
    this.onSave = onSave;
    this.render(currentProfile);
    this.show();
  }

  render(currentProfile = {}) {
    if (this.root) this.root.remove();

    let nameValue = currentProfile.name || "";
    let emailValue = currentProfile.email || "";
    let avatarValue = currentProfile.avatarUrl || "";

    this.overlay = el("div", { className: "overlay" });
    this.dialog = el("div", { className: "dialog profile-edit-dialog" });

    // Header
    const header = el("div", { className: "group-dialog-header" });
    const h2 = el("h2", {}, "Edit Profile");
    const closeBtn = el(
      "button",
      { type: "button", className: "group-dialog-close", "aria-label": "Close" },
      icon("x")
    );
    closeBtn.addEventListener("click", () => this.hide());
    header.append(h2, closeBtn);
    this.dialog.append(header);

    // Body
    const body = el("div", { className: "profile-dialog-body" });

    // Avatar Preview & Upload Area
    const avatarSection = el("div", { className: "profile-avatar-section" });
    const previewDisc = el("div", { className: "profile-avatar-preview-disc" });

    const updatePreview = () => {
      previewDisc.replaceChildren();
      const initial = (nameValue || "U").trim().charAt(0).toUpperCase();
      if (avatarValue) {
        const img = el("img", { className: "profile-avatar-preview-img", src: avatarValue, alt: "Avatar" });
        img.addEventListener("error", () => {
          previewDisc.replaceChildren(el("span", { className: "profile-avatar-preview-initial" }, initial));
        });
        previewDisc.appendChild(img);
      } else {
        previewDisc.appendChild(el("span", { className: "profile-avatar-preview-initial" }, initial));
      }
    };
    updatePreview();

    // Hidden file input for uploading from computer
    const fileInput = el("input", {
      type: "file",
      accept: "image/*",
      className: "profile-file-input",
      style: "display: none;",
    });

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        this.toast?.show("Image must be smaller than 2MB", { error: true });
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        avatarValue = ev.target?.result || "";
        if (urlInput) urlInput.value = "";
        updatePreview();
      };
      reader.readAsDataURL(file);
    });

    const uploadBtn = el("button", {
      type: "button",
      className: "btn btn-outline profile-upload-btn",
    }, icon("image"), el("span", {}, "Upload Photo"));
    uploadBtn.addEventListener("click", () => fileInput.click());

    const removeBtn = el("button", {
      type: "button",
      className: "btn btn-ghost profile-remove-avatar-btn",
      title: "Remove custom photo and use letter monogram",
    }, "Remove");
    removeBtn.addEventListener("click", () => {
      avatarValue = "";
      if (urlInput) urlInput.value = "";
      fileInput.value = "";
      updatePreview();
    });

    const avatarControls = el("div", { className: "profile-avatar-controls" },
      uploadBtn,
      removeBtn,
      fileInput
    );

    avatarSection.append(previewDisc, avatarControls);
    body.appendChild(avatarSection);

    // Name field
    const nameGroup = el("div", { className: "dialog-field" });
    const nameLabel = el("label", { className: "dialog-label", for: "prof-name-input" }, "Display Name");
    const nameInput = el("input", {
      type: "text",
      id: "prof-name-input",
      className: "dialog-input",
      placeholder: "e.g. Kamrul Islam",
      value: nameValue,
      maxlength: 60,
    });
    nameInput.addEventListener("input", () => {
      nameValue = nameInput.value;
      updatePreview();
    });
    nameGroup.append(nameLabel, nameInput);
    body.appendChild(nameGroup);

    // Email / Handle field
    const emailGroup = el("div", { className: "dialog-field" });
    const emailLabel = el("label", { className: "dialog-label", for: "prof-email-input" }, "Subtitle / Email");
    const emailInput = el("input", {
      type: "text",
      id: "prof-email-input",
      className: "dialog-input",
      placeholder: "e.g. user@gmail.com or Personal Profile",
      value: emailValue,
      maxlength: 80,
    });
    emailInput.addEventListener("input", () => {
      emailValue = emailInput.value;
    });
    emailGroup.append(emailLabel, emailInput);
    body.appendChild(emailGroup);

    // Image URL field
    const urlGroup = el("div", { className: "dialog-field" });
    const urlLabel = el("label", { className: "dialog-label", for: "prof-url-input" }, "Or Image URL");
    const urlInput = el("input", {
      type: "url",
      id: "prof-url-input",
      className: "dialog-input",
      placeholder: "https://...",
      value: avatarValue.startsWith("data:") ? "" : avatarValue,
    });
    urlInput.addEventListener("input", () => {
      const val = urlInput.value.trim();
      if (val) {
        avatarValue = val;
        fileInput.value = "";
      }
      updatePreview();
    });
    urlGroup.append(urlLabel, urlInput);
    body.appendChild(urlGroup);

    this.dialog.append(body);

    // Actions
    const actions = el("div", { className: "dialog-actions" });
    const cancelBtn = el("button", { type: "button", className: "btn" }, "Cancel");
    cancelBtn.addEventListener("click", () => this.hide());

    const saveBtn = el("button", { type: "button", className: "btn btn-primary" }, "Save Profile");
    saveBtn.addEventListener("click", async () => {
      const finalName = nameInput.value.trim() || "User Profile";
      const finalEmail = emailInput.value.trim();
      const finalAvatar = avatarValue.trim();

      saveBtn.disabled = true;
      try {
        // Save to user settings entity
        if (this.useCases?.saveUserSettings) {
          await this.useCases.saveUserSettings.execute({
            name: finalName,
            avatarUrl: finalAvatar,
          });
        }

        // Also persist profile overrides in localStorage
        try {
          localStorage.setItem("neptab_user_profile_name", finalName);
          localStorage.setItem("neptab_user_email", finalEmail);
          localStorage.setItem("neptab_user_avatar_url", finalAvatar);
        } catch {}

        this.toast?.show("Profile updated");
        this.events?.emit("settings:changed");
        this.onSave?.({ name: finalName, email: finalEmail, avatarUrl: finalAvatar });
        this.hide();
      } catch (err) {
        saveBtn.disabled = false;
        this.toast?.show(err.message || "Failed to update profile", { error: true });
      }
    });

    actions.append(cancelBtn, saveBtn);
    this.dialog.append(actions);

    this.overlay.append(this.dialog);
    this.root = this.overlay;

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.hide();
    });

    this.escHandler = (e) => {
      if (e.key === "Escape") this.hide();
    };
    document.addEventListener("keydown", this.escHandler);
  }

  show() {
    document.body.append(this.root);
    this.root.offsetHeight;
    this.overlay.classList.add("is-open");
    setTimeout(() => {
      this.root?.querySelector("#prof-name-input")?.focus();
    }, 50);
  }

  hide() {
    if (this.overlay) {
      this.overlay.classList.remove("is-open");
      setTimeout(() => {
        if (this.root) this.root.remove();
      }, 180);
    }
    if (this.escHandler) document.removeEventListener("keydown", this.escHandler);
  }
}
