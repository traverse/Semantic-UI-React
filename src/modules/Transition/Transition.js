import cx from 'classnames'
import _ from 'lodash'
import PropTypes from 'prop-types'
import { cloneElement, Component } from 'react'

import {
  makeDebugger,
  META,
  SUI,
  useKeyOnly,
} from '../../lib'
import TransitionGroup from './TransitionGroup'

const debug = makeDebugger('Transition')

/**
 * A transition is an animation usually used to move content in or out of view.
 */
export default class Transition extends Component {
  static propTypes = {
    /** Named animation event to used. Must be defined in CSS. */
    animation: PropTypes.oneOf(SUI.TRANSITIONS),

    /** Primary content. */
    children: PropTypes.node,

    /** Duration of the CSS transition animation in microseconds. */
    duration: PropTypes.number,

    /** Show the component; triggers the enter or exit animation. */
    into: PropTypes.bool,

    /** Wait until the first "enter" transition to mount the component (add it to the DOM). */
    mountOnEnter: PropTypes.bool,

    /**
     * Callback on each transition that changes visibility to shown.
     *
     * @param {null}
     * @param {object} data - All props with status.
     */
    onComplete: PropTypes.func,

    /**
     * Callback on each transition that changes visibility to hidden.
     *
     * @param {null}
     * @param {object} data - All props with status.
     */
    onHide: PropTypes.func,

    /**
     * Callback on each transition that changes visibility to shown.
     *
     * @param {null}
     * @param {object} data - All props with status.
     */
    onShow: PropTypes.func,

    /**
     * Callback on each transition complete.
     *
     * @param {null}
     * @param {object} data - All props with status.
     */
    onStart: PropTypes.func,

    /** React's key of the element. */
    reactKey: PropTypes.string,

    /** Run the enter animation when the component mounts, if it is initially shown. */
    transitionAppear: PropTypes.bool,

    /** Unmount the component (remove it from the DOM) when it is not shown. */
    unmountOnExit: PropTypes.bool,
  }

  static defaultProps = {
    animation: 'fade',
    duration: 500,
    into: true,
    mountOnEnter: true,
    transitionAppear: false,
    unmountOnExit: false,
  }

  static _meta = {
    name: 'Transition',
    type: META.TYPES.MODULE,
  }

  static ENTERED = 'ENTERED'
  static ENTERING = 'ENTERING'
  static EXITED = 'EXITED'
  static EXITING = 'EXITING'
  static UNMOUNTED = 'UNMOUNTED'

  static Group = TransitionGroup

  constructor(...args) {
    super(...args)

    const { initial: status, next } = this.computeInitialStatuses()
    this.nextStatus = next
    this.state = { status }
  }

  // ----------------------------------------
  // Lifecycle
  // ----------------------------------------

  componentDidMount() {
    debug('componentDidMount()')

    this.updateStatus()
  }

  componentWillReceiveProps(nextProps) {
    debug('componentWillReceiveProps()')

    const { current: status, next } = this.computeStatuses(nextProps)

    this.nextStatus = next
    if (status) this.setState({ status })
  }

  componentDidUpdate() {
    debug('componentDidUpdate()')

    this.updateStatus()
  }

  componentWillUnmount() {
    debug('componentWillUnmount()')
  }

  // ----------------------------------------
  // Callback handling
  // ----------------------------------------

  handleStart = () => {
    const { duration } = this.props
    const status = this.nextStatus

    this.nextStatus = null
    this.setState({ status, animating: true }, () => {
      _.invoke(this.props, 'onStart', null, { ...this.props, status })
      setTimeout(this.handleComplete, duration)
    })
  }

  handleComplete = () => {
    const { status: current } = this.state

    _.invoke(this.props, 'onComplete', null, { ...this.props, status: current })

    if (this.nextStatus) {
      this.handleStart()
      return
    }

    const status = this.computeCompletedStatus()
    const callback = current === Transition.ENTERING ? 'onShow' : 'onHide'

    this.setState({ status, animating: false }, () => {
      _.invoke(this.props, callback, null, { ...this.props, status })
    })
  }

  updateStatus = () => {
    const { animating } = this.state

    if (this.nextStatus) {
      this.nextStatus = this.computeNextStatus()
      if (!animating) this.handleStart()
    }
  }

  // ----------------------------------------
  // Helpers
  // ----------------------------------------

  computeClasses = () => {
    const { animation, children } = this.props
    const { animating, status } = this.state

    const childClasses = _.get(children, 'props.className')
    const entire = _.includes(SUI.ENTIRE_TRANSITIONS, animation)

    return cx(
      animation,
      childClasses,
      useKeyOnly(animating, 'animating'),
      useKeyOnly(entire && status === Transition.ENTERING, 'in'),
      useKeyOnly(entire && status === Transition.EXITING, 'out'),
      useKeyOnly(status === Transition.EXITED, 'hidden'),
      useKeyOnly(status !== Transition.EXITED, 'visible'),
      'transition',
    )
  }

  computeCompletedStatus = () => {
    const { unmountOnExit } = this.props
    const { status } = this.state

    if (status === Transition.ENTERING) return Transition.ENTERED
    return unmountOnExit ? Transition.UNMOUNTED : Transition.EXITED
  }

  computeInitialStatuses = () => {
    const {
      into,
      mountOnEnter,
      transitionAppear,
      unmountOnExit,
    } = this.props

    if (into) {
      if (transitionAppear) {
        return {
          initial: Transition.EXITED,
          next: Transition.ENTERING,
        }
      }
      return { initial: Transition.ENTERED }
    }

    if (mountOnEnter || unmountOnExit) return { initial: Transition.UNMOUNTED }
    return { initial: Transition.EXITED }
  }

  computeNextStatus = () => {
    const { animating, status } = this.state

    if (animating) return status === Transition.ENTERING ? Transition.EXITING : Transition.ENTERING
    return status === Transition.ENTERED ? Transition.EXITING : Transition.ENTERING
  }

  computeStatuses = props => {
    const { status } = this.state
    const { into } = props

    if (into) {
      return {
        current: status === Transition.UNMOUNTED && Transition.EXITED,
        next: (status !== Transition.ENTERING && status !== Transition.ENTERED) && Transition.ENTERING,
      }
    }

    return {
      next: (status === Transition.ENTERING || status === Transition.ENTERED) && Transition.EXITING,
    }
  }

  computeStyle = () => {
    const { children, duration } = this.props
    const childStyle = _.get(children, 'props.style')

    return { ...childStyle, animationDuration: `${duration}ms` }
  }

  // ----------------------------------------
  // Render
  // ----------------------------------------

  render() {
    debug('render()')
    debug('props', this.props)
    debug('state', this.state)

    const { children } = this.props
    const { status } = this.state

    if (status === Transition.UNMOUNTED) return null
    return cloneElement(children, {
      className: this.computeClasses(),
      style: this.computeStyle(),
    })
  }
}