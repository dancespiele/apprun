
import app, { App } from './app';
import { Reflect } from './decorator'
export class Component extends App {

  element;
  private _history = [];
  private _history_idx = -1;
  private enable_history;
  private global_event;
  protected rendered;

  private renderState(state) {
    if (!this.view) return;
    const html = this.view(state);
    const el = (typeof this.element === 'string') ?
      document.getElementById(this.element) : this.element;
    if (el && app.render) app.render(el, html);
    if (el) el['_component'] = this;
  }

  public setState(state, options: {render:boolean, history:boolean, callback?}) {
    if (state instanceof Promise) {
      // Promise will not be saved nor rendered saved
      // state will be saved and rendered when promise is resolved
      state.then(s => {
        this.setState(s, options)
      }).catch(err => {
        console.error(err);
        throw err;
      })
    } else {
      if (state == null) return;
      this.state = state;
      if (options.render !== false) this.renderState(state);
      if (options.history !== false && this.enable_history) {
        this._history = [...this._history, state];
        this._history_idx = this._history.length - 1;
      }
      if (typeof options.callback === 'function') options.callback(this.state);
      if (this.rendered) (this.rendered(this.state));
    }
  }

  constructor(
    protected state?,
    protected view?,
    protected update?,
    protected options?) {
    super();
  }

  public mount(element = null, options?: { render?: boolean, history?, global_event?: boolean}) {

    console.assert(!this.element, 'Component already mounted.')
    this.options = options = Object.assign(this.options || {}, options);
    this.element = element;
    this.global_event = options.global_event;
    this.enable_history = !!options.history;

    if (this.enable_history) {
      const prev = () => {
        this._history_idx --;
        if (this._history_idx >=0) {
          this.setState(this._history[this._history_idx], { render: true, history: false });
        }
        else {
          this._history_idx = 0;
        }
      };

      const next = () => {
        this._history_idx ++;
        if (this._history_idx < this._history.length) {
          this.setState(this._history[this._history_idx], { render: true, history: false });
        }
        else {
          this._history_idx = this._history.length - 1;
        }
      };
      this.on(options.history.prev || 'history-prev', prev)
      this.on(options.history.next || 'history-next', next)
    }
    this.add_actions();
    if (this.state === undefined) this.state = this['model'] || {};
    if (options.render) {
      this.setState(this.state, { render: true, history: true });
    } else {
      this.setState(this.state, { render: false, history: true });
    }
    return this;
  }

  is_global_event(name: string): boolean {
    return name && (name.startsWith('#') || name.startsWith('/'));
  }

  add_action(name, action, options: any = {}) {
    if (!action || typeof action !== 'function') return;
    this.on(name, (...p) => {
      const newState = action(this.state, ...p);
        this.setState(newState, options)
    }, options);
  }

  add_actions() {
    const actions = this.update || {};
    Reflect.getMetadataKeys(this).forEach(key => {
      if (key.startsWith('apprun-update:')) {
        const meta = Reflect.getMetadata(key, this)
        actions[meta.name] = meta.action || this[meta.key]
      }
    })
    const all = {};
    Object.keys(actions).forEach(name => {
      const action = actions[name];
      if (typeof action === 'function' || Array.isArray(action)) {
        name.split(',').forEach(n => all[n.trim()] = action)
      }
    })

    Object.keys(all).forEach(name => {
      const action = all[name];
      if (typeof action === 'function') {
        this.add_action(name, action);
      } else if (Array.isArray(action)) {
        this.add_action(name, action[0], action[1]);
      }
    });
  }

  start = (element = null): Component => {
    return this.mount(element, { render: true });
  }

  render = () => this.view(this.state);

  public run(name: string, ...args) {
    return this.global_event || this.is_global_event(name) ?
      app.run(name, ...args) :
      super.run(name, ...args);
  }

  public on(name: string, fn: (...args) => void, options?: any) {
    return this.global_event || this.is_global_event(name) ?
      app.on(name, fn, options) :
      super.on(name, fn, options);
  }

}
