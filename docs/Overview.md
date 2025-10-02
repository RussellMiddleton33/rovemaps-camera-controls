---
title: Overview
---

## Overview

RoveMaps Three Camera Controls provides GL JS-compatible camera controls for Three.js scenes. It aims for standard map controls with parity on API, gestures, and semantics: jump/ease/fly/fit, pan/zoom/rotate/pitch/roll, around-point invariants, padding/offset, inertia, reduced motion, and event model.

Key ideas:
- Transform abstraction maps MapLibre camera semantics to a Three.js camera.
- Projection helpers encapsulate control math for planar (and later spherical) scenes.
- Handler manager aggregates mouse/touch/keyboard/discrete inputs with accurate event sequencing.

See QuickStart for installation and usage. See API for detailed method/option docs.

Demo: /demo/
