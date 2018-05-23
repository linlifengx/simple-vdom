const Component = vdom.Component
const h = vdom.h

class App extends Component {
    constructor () {
        super()
        let idCount = 1
        this.state = {
            list: [],
            viewList: [],
            status: null, //active completed
        }
        this.onChange = (event) => {
            const text = event.target.value.trim()
            if (text) {
                this.setState({
                    list: this.state.list.concat({id: idCount++, text, status: 'active', editable:false})
                })
            }
            event.target.value = ''
        }
        this.remove = (item) => {
            const list = this.state.list
            const newList = list.filter(o => o != item)
            this.setState({
                list: newList
            })
        }
        this.filter = (status) => {
            this.setState({
                status
            })
        }
        this.getViewList = () => {
            return this.state.list.filter(o => {
                if (this.state.status == null) {
                    return true
                } else {
                    return o.status == this.state.status
                }
            })
        }
        this.changeStatus = (item) => {
            this.update(item, {status: item.status == 'active' ? 'completed' : 'active', editable: false})
        }
        this.update = (item, obj) => {
            const newItem = Object.assign({}, item, obj)
            this.setState({
                list: this.state.list.map(o => o == item ? newItem : (o.editable?Object.assign({},o,{editable:false}):o) )
            })
        }
        this.clear = () => {
            this.setState({
                list: this.state.list.filter(o => o.status == 'active')
            })
        }
        this.selectAll = () => {
            const status = this.hasActive() ? 'completed' : 'active'
            this.setState({
                list: this.state.list.map(o => Object.assign({}, o, {status}))
            })
        }
        this.hasActive = () => {
            const activeItem = this.state.list.find(o => o.status == 'active')
            if (activeItem) {
                return true
            } else {
                return false
            }
        }
        this.getActiveCount = () => {
            let count = 0
            for (let o of this.state.list) {
                if (o.status == 'active') {
                    count++
                }
            }
            return count
        }
    }

    render () {
        const viewList = this.getViewList()
        const activeCount = this.getActiveCount()
        const hide = this.state.list.length == 0

        return h('div', null, [
            h('div', {class:'header'}, 'todos'),
            h('div', {class:'body'}, [
                h('div', {class:'input-box'}, [
                    h('a', {class:'select-all ' + (this.hasActive()?'active':'') + (hide?'hide':''), 
                        onClick:this.selectAll}),
                    h('input', {placeholder: 'What needs to be done?', onChange: this.onChange})
                ]),
                h(List, {list: viewList, remove: this.remove, changeStatus: this.changeStatus, update: this.update}),
                h(Footer, {count: activeCount, filter: this.filter, clear: this.clear, status: this.state.status, hide})
            ])
        ])
    }
}

class List extends Component {
    constructor () {
        super()
    }

    render () {
        const list = this.props.list
        const changeStatus = this.props.changeStatus
        const update = this.props.update
        return h('div', {class: 'list-box'}, list.map(o => h(Item, {key: o.id, model: o, changeStatus, update})))
    }
}

class Item extends Component {
    constructor () {
        super()

        this.inserted = (vnode) => {
            const height = vnode.dom.offsetHeight
            const tumbling = [
                {height: '0px', overflow: 'hidden'},
                {height: height + 'px', overflow: 'hidden'}
            ]
            const timing = {
                duration: 250
            }
            vnode.dom.animate(tumbling, timing)
        }

        this.removed = (vnode, cb) => {
            const height = vnode.dom.offsetHeight
            const tumbling = [
                {height: height + 'px', overflow: 'hidden'},
                {height: '0px', overflow: 'hidden'}
            ]
            const timing = {
                duration: 250
            }
            vnode.dom.animate(tumbling, timing).onfinish = function () {cb()}
        }
        this.onClick = () => {
            this.props.changeStatus(this.props.model)
        }
        this.onDblclick = () => {
            console.log(this.props.model)
            this.props.update(this.props.model, {editable:true})
        }
        this.onChange = (event) => {
            const text = event.target.value.trim()
            if (text) {
                this.props.update(this.props.model, {text, editable:false})
            }
        }
    }

    render () {
        const model = this.props.model
        return h('div', {
            key: model.id,
            class: 'item ' + model.status,
            onDblclick: this.onDblclick
            //animation: {inserted: this.inserted, remove: this.removed}
        }, [
            h('a', {class:'select-item', onClick: this.onClick}),
            h('div', {class:'item-text'}, model.text),
            h('input', {class:'item-input ' + (model.editable?'edit':''),
                value: model.text, onChange: this.onChange})
        ])
    }
}

class Footer extends Component {
    constructor () {
        super()

        this.showAll = () => {
            this.props.filter(null)
        }
        this.showActive = () => {
            this.props.filter('active')
        }
        this.showCompleted = () => {
            this.props.filter('completed')
        }
        this.clear = () => {
            this.props.clear()
        }
    }

    render () {
        const count = this.props.count
        const status = this.props.status
        const hide = this.props.hide
        return h('div', {class: 'footer ' + (hide?'hide':'')}, [
            h('div', {class:'count'}, count + ' item left'),
            h('div', {class:'clear', onClick: this.clear}, 'Clear completed'),
            h('div', {class:'button ' + (status==null?'active':''), onClick: this.showAll}, 'All'),
            h('div', {class:'button ' + (status=='active'?'active':''), onClick: this.showActive}, 'Active'),
            h('div', {class:'button ' + (status=='completed'?'active':''), onClick: this.showCompleted}, 'Completed'),
            
        ])
    }
}

window.onload = function () {
    vdom.mount(document.querySelector('#app'), new App())
}