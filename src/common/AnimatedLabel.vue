
<template>
    <span class="vommondAnimatedLabel">
        {{text}}
    </span>
</template>
<script>


export default {
   name: 'AnimatedLabel',
   mixins:[],
   props:{
        'value':{
            type: String
        },
        'duration': {
            type: Number,
            default: 100
        }
    },
   data: function () {
       return {
            count: 0
       }
   },
   computed: {
        text () {
            if (this.value && this.value.length > this.count) {
                return this.value.substring(0, this.count)
            }
            if (this.interval) {
                clearInterval(this.interval)
            }
            return this.value
        }
   },
   methods: {
        start () {
            this.cleanUp()
            if (this.value) {
                const time = this.duration
                this.interval = setInterval(() => {
                    this.count++
                }, time)
            }
        },
        cleanUp() {
            this.count = 0
            if (this.interval) {
                clearInterval(this.interval)
            }
        }
   },
   watch: {
       value () {
           this.start()
       }
   },
   mounted () {
        this.start()
   },
   beforeUnmount () {
    this.cleanUp() 
   }
}
</script>