# Short write-up — Game Night Access Adapter

## Problem

Browser games often assume mouse, multi-key keyboard chords, and fast continuous play. Those assumptions lock out players with motor access needs from playing with friends and family. Our co-designer, Justin, loves racing and FIFA but is limited by immobile fingers and non-customizable controls.

## Approach

We adapt one open-source browser racer — **LibreCorsa** — instead of building a new game. A Chrome extension remaps accessible inputs (head tracking, voice, phone tilt) onto the keyboard codes LibreCorsa already understands. A small local bridge fans inputs over WebSocket. The phone is a **software controller** (LAN web page), not USB hardware, so the solution stays within the challenge's no-extra-hardware rule and works on Justin's MacBook.

## Toolkit

We use and extend the [AI for Accessibility Toolkit](https://github.com/AI-for-Accessibility-Collective/AI-for-Accessibility-Toolkit) (fork: [Isomkevin/AI-for-Accessibility-Toolkit](https://github.com/Isomkevin/AI-for-Accessibility-Toolkit)). Voice commands go through the toolkit Controller into our shared input protocol. Findings and gaps from Justin's tests are filed as toolkit issues; contribution materials live in `docs/toolkit-contribution/`.

## What “done” means for Saturday

- Public monorepo with game + toolkit submodules and a working extension demo path
- Remappable controls Justin can change without editing code
- At least one accessible input beyond the demo pad (voice and/or camera and/or phone)
- Testing log + toolkit issues + demo video + this write-up

## Credits

Game Night team with co-designer Justin Machogu. LibreCorsa (MIT code). AI for Accessibility Toolkit (Apache-2.0).
