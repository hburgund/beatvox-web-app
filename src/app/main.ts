import { mount } from 'svelte';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/700.css';
import './theme.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
