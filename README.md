#simple-vdom
一个简单的virtual-dom实现，只有不到500行，支持类似react的自定义组件功能。

---------------------------------------------------

##简单的例子
    const Component = vdom.Component
    const h = vdom.h

    class App extends Component {
        constructor () {
            super()

            this.state = {
                value: ''
            }

            this.onInput = (event) => {
                this.setState({
                    value: event.target.value
                })
            }
        }

        render () {
            return h('div', null, [
                h('input', {value: this.state.value, onInput:this.onInput}),
                h('div', null, this.state.value)
            ])
        }
    }

    vdom.mount(document.querySelector('#app'), new App())

## TodoMVC Demo
<https://linlifengx.github.io/demos/simple-vdom-todo-mvc/index.html>