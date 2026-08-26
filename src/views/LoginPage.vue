<template>
  <div class="qux-login">
    <template v-if="isQuxAuth">

      <div class="qux-login__language">
        <LanguagePicker @change="setLanguage" />
      </div>

      <section class="qux-login__panel">

        <div class="qux-login__wordmark">QUX<span>.</span></div>

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
$ink: #1a1a1a;
$muted: #6b6b6b;
$line: #d9d9d9;
$accent: #2b49c8;
$danger: #b3372a;

.qux-login {
  position: relative;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: #fff;
  color: $ink;
  font-family: 'Avenir Next', 'Segoe UI', 'Helvetica Neue', Helvetica, sans-serif;
}

.qux-login__language {
  position: absolute;
  top: 20px;
  right: 28px;
}

.qux-login__panel {
  width: min(360px, 100%);
}

.qux-login__wordmark {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin-bottom: 32px;

  span {
    color: $accent;
  }
}

.qux-login__tabs {
  display: flex;
  gap: 24px;
  margin-bottom: 28px;
}

.qux-login__tab {
  appearance: none;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0 0 6px 0;
  font-family: inherit;
  font-size: 15px;
  color: $muted;
  cursor: pointer;

  &:hover,
  &.qux-login__tab--active {
    color: $ink;
  }

  &.qux-login__tab--active {
    border-bottom-color: $ink;
  }
}

.qux-login__title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.qux-login__lede {
  margin: 8px 0 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: $muted;
}

.qux-login__form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 28px;
}

.qux-login__field {
  display: block;

  label {
    display: block;
    font-size: 13px;
    color: $muted;
    margin-bottom: 6px;
  }

  input {
    width: 100%;
    border: 1px solid $line;
    border-radius: 6px;
    background: #fff;
    padding: 10px 12px;
    font-family: inherit;
    font-size: 15px;
    color: $ink;

    &::placeholder {
      color: #ababab;
    }

    &:focus {
      outline: none;
      border-color: $ink;
    }
  }
}

.qux-login__check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: $muted;
  cursor: pointer;

  a {
    color: $accent;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  input {
    accent-color: $ink;
    cursor: pointer;
  }
}

.qux-login__error {
  margin: 0;
  font-size: 14px;
  color: $danger;
}

.qux-login__link {
  align-self: flex-start;
  font-size: 14px;
  color: $accent;
  cursor: pointer;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.qux-login__submit {
  appearance: none;
  border: none;
  border-radius: 6px;
  height: 48px;
  background: $ink;
  color: #fff;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: #333;
  }

  &:focus-visible {
    outline: 2px solid $accent;
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  &.qux-login__submit--danger:hover {
    background: $danger;
  }
}
</style>
