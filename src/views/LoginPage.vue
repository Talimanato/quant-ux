<template>
  <div class="qux-login" :class="{ 'qux-login--reset': resetToken }">
    <template v-if="isQuxAuth">

      <aside class="qux-login__aside">
        <div class="qux-login__wordmark">QUX<span class="qux-login__wordmark-dot">.</span></div>

        <div class="qux-login__pitch">
          <h1 class="qux-login__headline">
            {{ $t('login.brand-slogan-1') }}<br />
            {{ $t('login.brand-slogan-2') }}<br />
            <em>{{ $t('login.brand-slogan-3') }}</em>
          </h1>
          <p class="qux-login__sub">{{ $t('login.brand-sub') }}</p>
        </div>

        <!-- wireframe sketch, drawn on load -->
        <svg class="qux-login__sketch" viewBox="0 0 340 430" fill="none" aria-hidden="true">
          <g class="wire wire-d1">
            <rect x="42" y="26" width="150" height="300" rx="14" pathLength="1" />
            <line x1="98" y1="44" x2="136" y2="44" pathLength="1" />
            <rect x="62" y="70" width="110" height="8" rx="4" pathLength="1" />
            <rect x="62" y="92" width="110" height="52" rx="4" pathLength="1" />
            <rect x="62" y="156" width="110" height="52" rx="4" pathLength="1" />
          </g>
          <g class="wire wire-d2 wire-accent">
            <rect x="62" y="226" width="110" height="26" rx="6" pathLength="1" />
          </g>
          <g class="wire wire-d3 wire-accent">
            <path d="M172 239 C 212 239, 218 130, 248 128" pathLength="1" stroke-dasharray="1" />
            <path d="M240 121 L 250 127 L 241 134" pathLength="1" />
          </g>
          <g class="wire wire-d4">
            <rect x="248" y="72" width="64" height="104" rx="8" pathLength="1" />
            <line x1="260" y1="90" x2="300" y2="90" pathLength="1" />
            <line x1="260" y1="104" x2="300" y2="104" pathLength="1" />
            <line x1="260" y1="118" x2="288" y2="118" pathLength="1" />
          </g>
          <g class="wire wire-d5">
            <path d="M262 152 l 10 12 l 20 -24" pathLength="1" />
          </g>
        </svg>

        <div class="qux-login__aside-footer">
          <span>{{ $t('login.footer-1') }}</span><i></i><span>{{ $t('login.footer-2') }}</span><i></i><span>{{ $t('login.footer-3') }}</span>
        </div>
      </aside>

      <main class="qux-login__main">
        <div class="qux-login__language">
          <LanguagePicker @change="setLanguage" />
        </div>
        <section class="qux-login__panel">

          <div class="qux-login__mobile-wordmark">QUX<span>.</span></div>

          <nav v-if="!resetToken" class="qux-login__tabs">
            <button type="button" class="qux-login__tab" :class="{ 'qux-login__tab--active': tab === 'login' }" @click="setTab('login')">{{ $t('login.tab-login') }}</button>
            <button v-if="allowSignUp" type="button" class="qux-login__tab" :class="{ 'qux-login__tab--active': tab === 'signup' }" @click="setTab('signup')">{{ $t('login.tab-signup') }}</button>
          </nav>

          <h2 class="qux-login__title">
            {{ resetToken ? $t('login.title-reset') : (tab === 'login' ? $t('login.title-login') : $t('login.title-signup')) }}
          </h2>
          <p class="qux-login__lede">
            {{ resetToken ? $t('login.lede-reset') : (tab === 'login' ? $t('login.lede-login') : $t('login.lede-signup')) }}
          </p>

          <!-- login -->
          <form v-if="tab === 'login' && !resetToken" class="qux-login__form" @submit.prevent="login">
            <span class="qux-login__field">
              <label for="qux-login-email">{{ $t('login.email') }}</label>
              <input id="qux-login-email" type="text" autocomplete="username" :placeholder="$t('login.placeholder-email')" v-model="email" />
            </span>
            <span class="qux-login__field">
              <label for="qux-login-password">{{ $t('login.password') }}</label>
              <input id="qux-login-password" type="password" autocomplete="current-password" placeholder="••••••••" v-model="password" @keyup.enter="login" />
            </span>

            <p class="qux-login__error" v-if="errorMessage && errorMessage.trim()">{{ errorMessage }}</p>
            <a v-if="hasLoginError" class="qux-login__link" @click="requestPasswordReset">{{ $t('login.forgot') }}</a>

            <button class="qux-login__submit" type="submit">{{ $t('login.submit-login') }}</button>
          </form>

          <!-- sign up -->
          <form v-if="tab === 'signup' && !resetToken" class="qux-login__form" @submit.prevent="signup">
            <span class="qux-login__field">
              <label for="qux-signup-email">{{ $t('login.email') }}</label>
              <input id="qux-signup-email" type="text" autocomplete="username" :placeholder="$t('login.placeholder-email')" v-model="email" />
            </span>
            <span class="qux-login__field">
              <label for="qux-signup-password">{{ $t('login.password') }}</label>
              <input id="qux-signup-password" type="password" autocomplete="new-password" :placeholder="$t('login.placeholder-password')" v-model="password" @keyup.enter="signup" />
            </span>

            <label class="qux-login__check">
              <input type="checkbox" v-model="tos" />
              <span>{{ $t('login.tos-pre') }} <a href="#/tos.html" target="_blank">{{ $t('login.tos-link') }}</a></span>
            </label>

            <p class="qux-login__error" v-if="errorMessage && errorMessage.trim()">{{ errorMessage }}</p>

            <button class="qux-login__submit" type="submit" :disabled="signupInProgress">{{ $t('login.submit-signup') }}</button>
          </form>

          <!-- reset -->
          <form v-if="resetToken" class="qux-login__form" @submit.prevent="resetPassword">
            <span class="qux-login__field">
              <label for="qux-reset-email">{{ $t('login.email') }}</label>
              <input id="qux-reset-email" type="text" autocomplete="username" :placeholder="$t('login.placeholder-email')" v-model="email" />
            </span>
            <span class="qux-login__field">
              <label for="qux-reset-password">{{ $t('login.new-password') }}</label>
              <input id="qux-reset-password" type="password" autocomplete="new-password" :placeholder="$t('login.placeholder-password')" v-model="password" />
            </span>

            <p class="qux-login__error" v-if="errorMessage && errorMessage.trim()">{{ errorMessage }}</p>

            <button class="qux-login__submit qux-login__submit--danger" type="submit">{{ $t('login.submit-reset') }}</button>
          </form>

        </section>
      </main>

    </template>
  </div>
</template>

<script>
import Services from 'services/Services'
import Logger from 'common/Logger'
import topic from 'dojo/topic'
import LanguagePicker from 'page/LanguagePicker'

export default {
  name: "Header",
  mixins: [],
  props: ['user'],
  data: function() {
    return {
        hasLoginError: false,
        resetToken: false,
        email: '',
        password: '',
        tos: false,
        errorMessage: ' ',
        signupInProgress: false,
        tab: 'login',
        config: {}
    }
  },
  computed: {
    isQuxAuth () {
        return Services.getConfig().auth !== 'keycloak'
    },
    allowSignUp () {
        return this.config && this.config.user && this.config.user.allowSignUp === true
    }
  },
  watch: {
    'user' (v) {
      this.logger.log(6, 'watch', 'user >> ' + v.email)
    }
  },
  components: {
    'LanguagePicker': LanguagePicker
  },
  methods: {
      setLanguage (language) {
          this.logger.log(-1, 'setLanguage', 'entry', language)
          Services.getUserService().setLanguage(language)
          this.$root.$i18n.locale = language
      },
      setTab (tab) {
        this.tab = tab
        this.errorMessage = ' '
      },
      async resetPassword () {
        this.logger.info('resetPassword', 'enter ', this.email)

        if (this.email.length < 2) {
            this.errorMessage = this.$t('login.error-email')
            return;
        }

        if (this.password.length < 6) {
            this.errorMessage = this.$t('login.error-password-short')
            return;
        }

        if (this.resetToken.length < 6) {
            this.errorMessage = this.$t('login.error-token')
            return;
        }

        let result = await Services.getUserService().reset2(this.email, this.password, this.resetToken)
        if (result.type === 'error') {
            this.errorMessage = this.$t('login.error-generic')
        } else {
            this.errorMessage = ''
            this.resetToken = ''
            this.tab = 'login'
            this.$router.push('/')
        }

      },
      async requestPasswordReset () {
        this.logger.info('requestPasswordReset', 'enter ', this.email)
        await Services.getUserService().reset(this.email)
        this.errorMessage = this.$t('login.reset-sent')
      },
      async login () {
        this.logger.info('login', 'enter ', this.email)
        let result
        try {
            result = await Services.getUserService().login({
              email:this.email,
              password: this.password
            })
        } catch (err) {
            // the service rejects on non-200 answers
            result = { type: 'error' }
        }
        if (result.type == "error") {
            topic.publish("Error", "Wrong login credentials")
            this.errorMessage = this.$t('login.error-login')
            this.hasLoginError = true
        } else {
            this.$emit('login', result);
            topic.publish('UserLogin', result)
            this.hasLoginError = false
        }
      },
      async signup() {
        this.logger.info('signup', 'enter ', this.email)

        if (this.signupInProgress) {
            this.logger.info('signup', 'already in progress')
            return;
        }


        if (this.password.length < 6) {
            this.errorMessage = this.$t('login.error-password-short')
            return;
        }

        if (this.tos !== true) {
            this.errorMessage = this.$t('login.error-tos')
            return;
        }

        this.signupInProgress = true
        let result
        try {
            result = await Services.getUserService().signup({
                email:this.email,
                password: this.password,
                tos: this.tos
            })
        } catch (err) {
            // the service rejects on non-200 answers (bad domain, no
            // sign-ups, taken email, ...)
            result = { type: 'error', errors: [] }
        }
        this.signupInProgress = false
        if (result.type == "error") {
            if (result.errors && result.errors.indexOf("user.create.domain") >= 0) {
                this.errorMessage = this.$t('login.error-domain')
            } else if (result.errors && result.errors.indexOf("user.create.nosignup") >= 0) {
                this.errorMessage = this.$t('login.error-nosignup')
            } else if (result.errors && result.errors.indexOf("user.email.not.unique") >= 0) {
                this.errorMessage = this.$t('login.error-taken')
            } else {
                this.errorMessage = this.$t('login.error-signup')
            }
        } else {
            let user = await Services.getUserService().login({
                email:this.email,
                password: this.password,
            })
            this.$emit('login', user);
            topic.publish('UserLogin', user)
            this.logger.log(-1,'signup', 'exit with login', this.email)
        }
      }
  },
  async mounted() {
    this.logger = new Logger('LoginPage')
   	this.resetToken = this.$route.query.id
    if (this.resetToken && this.resetToken.length > 2) {
        this.logger.log(-1,'mounted', 'reset ')
        this.tab = 'reset'
    }

    this.config = Services.getConfig()
    this.logger.log(1,'mounted', 'exit > ')
  }
}
</script>

<style lang="scss" scoped>
$ink: #1d1b16;
$ink-soft: rgba(29, 27, 22, 0.62);
$paper: #f6f4ef;
$paper-line: #d9d3c6;
$accent: #2b49c8;
$danger: #b3372a;
$serif: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
$sans: 'Avenir Next', 'Segoe UI', 'Helvetica Neue', Helvetica, sans-serif;

.qux-login {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 46%) 1fr;
  font-family: $sans;
  color: $ink;
  background: $paper;
}

/* ---------------- brand panel ---------------- */

.qux-login__aside {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: clamp(36px, 5vw, 72px);
  background: $ink;
  color: $paper;
  overflow: hidden;

  /* faint drafting grid */
  background-image:
    linear-gradient(rgba(246, 244, 239, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(246, 244, 239, 0.045) 1px, transparent 1px);
  background-size: 44px 44px;
}

.qux-login__wordmark {
  font-family: $serif;
  font-weight: 700;
  font-size: 30px;
  letter-spacing: 0.02em;
}

.qux-login__wordmark-dot {
  color: #7d90e8;
}

.qux-login__pitch {
  margin-top: clamp(24px, 5vh, 56px);
}

.qux-login__headline {
  font-family: $serif;
  font-weight: 600;
  font-size: clamp(38px, 4.2vw, 58px);
  line-height: 1.04;
  letter-spacing: -0.015em;

  em {
    font-style: italic;
    color: #aab5ec;
  }
}

.qux-login__sub {
  margin-top: 22px;
  max-width: 34ch;
  font-size: 15px;
  line-height: 1.65;
  color: rgba(246, 244, 239, 0.72);
}

.qux-login__sketch {
  margin-top: clamp(20px, 4vh, 44px);
  width: min(320px, 78%);
  stroke: rgba(246, 244, 239, 0.52);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;

  .wire-accent {
    stroke: #7d90e8;
  }
}

.qux-login__aside-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(246, 244, 239, 0.55);

  i {
    width: 22px;
    height: 1px;
    background: rgba(246, 244, 239, 0.3);
  }
}

/* ---------------- form panel ---------------- */

.qux-login__main {
  display: grid;
  place-items: center;
  padding: clamp(28px, 5vw, 64px);
  position: relative;
}

.qux-login__language {
  position: absolute;
  top: 20px;
  right: 28px;
}

.qux-login__panel {
  width: min(420px, 100%);
}

.qux-login__mobile-wordmark {
  display: none;
  font-family: $serif;
  font-weight: 700;
  font-size: 24px;
  margin-bottom: 26px;

  span {
    color: $accent;
  }
}

.qux-login__tabs {
  display: flex;
  gap: 26px;
  margin-bottom: clamp(26px, 4vh, 40px);
}

.qux-login__tab {
  appearance: none;
  background: none;
  border: none;
  padding: 0 0 8px 0;
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  color: $ink-soft;
  cursor: pointer;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: $ink;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  }

  &:hover {
    color: $ink;
  }

  &.qux-login__tab--active {
    color: $ink;

    &::after {
      transform: scaleX(1);
    }
  }
}

.qux-login__title {
  font-family: $serif;
  font-weight: 600;
  font-size: clamp(28px, 3vw, 34px);
  letter-spacing: -0.01em;
}

.qux-login__lede {
  margin: 10px 0 0 0;
  font-size: 14.5px;
  line-height: 1.6;
  color: $ink-soft;
}

.qux-login__form {
  display: flex;
  flex-direction: column;
  margin-top: clamp(24px, 4vh, 40px);
}

.qux-login__field {
  display: block;
  position: relative;
  margin-bottom: 26px;

  label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $ink-soft;
  }

  input {
    width: 100%;
    border: none;
    border-bottom: 1px solid $paper-line;
    background: transparent;
    padding: 10px 2px;
    margin-top: 4px;
    font-family: inherit;
    font-size: 16px;
    color: $ink;
    border-radius: 0;

    &::placeholder {
      color: rgba(29, 27, 22, 0.34);
    }

    &:focus {
      outline: none;
    }
  }

  /* accent underline grows in on focus */
  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 25px;
    height: 2px;
    background: $accent;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    pointer-events: none;
  }

  &:focus-within::after {
    transform: scaleX(1);
  }
}

.qux-login__check {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: -4px 0 24px 0;
  font-size: 14px;
  color: $ink-soft;
  cursor: pointer;

  a {
    color: $accent;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  input {
    appearance: none;
    width: 18px;
    height: 18px;
    margin: 0;
    border: 1.5px solid $paper-line;
    border-radius: 3px;
    background: transparent;
    display: grid;
    place-content: center;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;

    &::before {
      content: '';
      width: 9px;
      height: 9px;
      transform: scale(0);
      transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
      clip-path: polygon(14% 44%, 0 62%, 42% 100%, 100% 18%, 84% 4%, 40% 68%);
      background: $paper;
    }

    &:checked {
      background: $ink;
      border-color: $ink;

      &::before {
        transform: scale(1);
      }
    }

    &:focus-visible {
      outline: 2px solid $accent;
      outline-offset: 2px;
    }
  }
}

.qux-login__error {
  margin: -6px 0 18px 0;
  font-size: 14px;
  color: $danger;
}

.qux-login__link {
  margin: -6px 0 22px 0;
  font-size: 14px;
  color: $accent;
  cursor: pointer;
  text-decoration: none;
  align-self: flex-start;

  &:hover {
    text-decoration: underline;
  }
}

.qux-login__submit {
  appearance: none;
  border: none;
  border-radius: 2px;
  height: 52px;
  margin-top: 6px;
  background: $ink;
  color: $paper;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background 0.25s, transform 0.12s;

  &:hover {
    background: $accent;
  }

  &:active {
    transform: translateY(1px);
  }

  &:focus-visible {
    outline: 2px solid $accent;
    outline-offset: 3px;
  }

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  &.qux-login__submit--danger:hover {
    background: $danger;
  }
}

/* ---------------- entrance ---------------- */

.qux-login__aside > *,
.qux-login__panel > * {
  animation: qux-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.qux-login__wordmark { animation-delay: 0.05s; }
.qux-login__pitch { animation-delay: 0.15s; }
.qux-login__sketch { animation-delay: 0.25s; }
.qux-login__aside-footer { animation-delay: 0.4s; }
.qux-login__tabs { animation-delay: 0.2s; }
.qux-login__title { animation-delay: 0.28s; }
.qux-login__lede { animation-delay: 0.34s; }
.qux-login__form { animation-delay: 0.42s; }

@keyframes qux-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* wireframe draws itself once */
.qux-login__sketch .wire {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: qux-draw 1.3s cubic-bezier(0.33, 1, 0.68, 1) forwards;
}

.qux-login__sketch .wire-d1 { animation-delay: 0.35s; }
.qux-login__sketch .wire-d2 { animation-delay: 0.85s; }
.qux-login__sketch .wire-d3 { animation-delay: 1.05s; }
.qux-login__sketch .wire-d4 { animation-delay: 1.25s; }
.qux-login__sketch .wire-d5 { animation-delay: 1.7s; }

@keyframes qux-draw {
  to {
    stroke-dashoffset: 0;
  }
}

/* ---------------- small screens ---------------- */

@media (max-width: 880px) {
  .qux-login {
    grid-template-columns: 1fr;
  }

  .qux-login__aside {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
    padding: 22px 24px;
    background-size: 28px 28px;
  }

  .qux-login__wordmark {
    font-size: 22px;
  }

  .qux-login__pitch {
    margin-top: 0;
    text-align: right;
  }

  .qux-login__headline {
    display: none;
  }

  .qux-login__sub {
    margin-top: 0;
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(246, 244, 239, 0.6);
  }

  .qux-login__sketch,
  .qux-login__aside-footer {
    display: none;
  }

  .qux-login__main {
    padding: 36px 24px 48px 24px;
    place-items: start center;
  }

  .qux-login__mobile-wordmark {
    display: block;
  }

  .qux-login__aside > *,
  .qux-login__panel > * {
    animation: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .qux-login__aside > *,
  .qux-login__panel > *,
  .qux-login__sketch .wire {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
