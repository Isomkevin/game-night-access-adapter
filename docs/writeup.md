# Short write-up — Game Night Access Adapter

> Longer product narrative (inputs, remap, architecture roles, status): [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).

## Problem

Browser games often assume mouse, multi-key keyboard chords, and fast continuous play. Those assumptions lock out players with motor access needs from playing with friends and family. Our co-designer, Justin, loves racing and FIFA but is limited by immobile fingers and non-customizable controls. His core ask: **fully remappable controls**.

## Approach

We do not build a new game. A Chrome extension remaps accessible inputs (head / vision tracking, voice, phone tilt, on-screen pad) onto the keyboard codes keyboard-driven browser games already understand. A small local bridge fans inputs over WebSocket. The phone is a **software controller** (LAN web page), not USB hardware, so the solution stays within the challenge's no-extra-hardware rule and works on Justin's MacBook. **LibreCorsa** ships as the ready demo; players can pin any compatible browser game tab.

Players change mappings in the extension Options / Setup UI without editing code; profiles export and import as JSON. Injection applies to the pinned, focused game tab.

## Toolkit

We use and extend the [AI for Accessibility Toolkit](https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit) (fork: [Isomkevin/AI-for-Accessibility-Toolkit](https://github.com/Isomkevin/AI-for-Accessibility-Toolkit)). Voice commands go through the toolkit Controller into our shared input protocol. Findings and gaps from Justin's tests are filed as toolkit issues; contribution materials live in `docs/toolkit-contribution/`. Upstream example PR: [#55](https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit/pull/55).

## What “done” means for Saturday

- Public monorepo with game + toolkit submodules and a working extension demo path
- Remappable controls Justin can change without editing code
- At least one accessible input beyond the on-screen pad (voice and/or camera and/or phone)
- Testing log + toolkit issues + demo video + this write-up

## Credits

Game Night team with co-designer Justin Machogu. Demo game LibreCorsa (MIT code). AI for Accessibility Toolkit (Apache-2.0).
