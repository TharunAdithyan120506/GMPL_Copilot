---
name: Industrial Neobrutalist
colors:
  surface: '#FFFFFF'
  surface-dim: '#dedad0'
  surface-bright: '#fef9ef'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f3e9'
  surface-container: '#f2ede3'
  surface-container-high: '#ece8de'
  surface-container-highest: '#e7e2d8'
  on-surface: '#1d1c16'
  on-surface-variant: '#554335'
  inverse-surface: '#32302a'
  inverse-on-surface: '#f5f0e6'
  outline: '#887363'
  outline-variant: '#dcc2af'
  surface-tint: '#904d00'
  primary: '#904d00'
  on-primary: '#ffffff'
  primary-container: '#e8820d'
  on-primary-container: '#512900'
  inverse-primary: '#ffb77b'
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2dfde'
  on-secondary-container: '#636262'
  tertiary: '#006397'
  on-tertiary: '#ffffff'
  tertiary-container: '#00a4f6'
  on-tertiary-container: '#003756'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdcc2'
  primary-fixed-dim: '#ffb77b'
  on-primary-fixed: '#2e1500'
  on-primary-fixed-variant: '#6d3900'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#93ccff'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#004b73'
  background: '#fef9ef'
  on-background: '#1d1c16'
  surface-variant: '#e7e2d8'
  deep-orange: '#C1440E'
  success: '#3FA34D'
  warning: '#F2B705'
  danger: '#E63946'
  info: '#2E86AB'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  data-lg:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  data-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
spacing:
  base: 8px
  gutter: 24px
  margin: 32px
  bento-gap: 16px
---

## Brand & Style

The brand identity bridges the gap between raw industrial utility and human warmth. It leverages a **Neobrutalist** design movement to create a high-contrast, high-impact environment that feels authoritative yet accessible for non-technical users. 

Key attributes:
- **Honest & Raw:** The UI does not hide behind soft gradients or subtle blurs; it uses thick lines and hard shadows to define space.
- **Tactile Feedback:** Every interactive element provides physical-style feedback through "collapsing" shadows, making digital actions feel like pressing physical buttons.
- **Bento-Box Organization:** Information is grouped into clear, functional blocks of varying sizes, ensuring a structured yet dynamic hierarchy that prioritizes critical data points.

## Colors

The palette is rooted in an industrial "Canvas Cream" background to reduce eye strain while maintaining a warm, non-sterile atmosphere. 

- **Primary Orange:** Reserved for the most important actions and brand highlights.
- **Ink Black:** Used for all structural elements, including 2-4px borders and hard shadows, ensuring maximum contrast.
- **Status Colors:** High-saturation tones are used for immediate semantic recognition. Always pair these with icons to ensure accessibility on factory floors with varying lighting conditions.

## Typography

The typography system uses three distinct families to separate intent:
- **Space Grotesk (Bold):** Used for headlines and hero numbers. Its geometric, slightly technical character reinforces the industrial theme.
- **Inter:** The primary workhorse for body text, chosen for its exceptional legibility across mobile and desktop screens.
- **JetBrains Mono:** Dedicated to production data, weights, and counts. The monospaced nature ensures that numeric columns align perfectly in tables and bento-box tiles, aiding quick scanning of technical data.

## Layout & Spacing

The system utilizes a **12-column fluid grid** for desktop and a **single-column fluid layout** for mobile. 

- **Bento Logic:** Dashboard layouts must use fixed-gap gutters (16px) between cards. Elements should span across grid columns in a 2x2, 4x2, or 6x4 configuration to create a varied, easy-to-read hierarchy.
- **Visual Rhythm:** Generous external margins (32px) prevent the dense, high-contrast UI from feeling cluttered.
- **Touch Targets:** For vendor-side mobile interfaces, all interactive areas must maintain a minimum height of 48px to accommodate factory-floor usage.

## Elevation & Depth

This design system rejects blurred shadows in favor of **Hard Offset Shadows**. 

- **Resting State:** Elements (cards, buttons, inputs) feature a `6px 6px 0px #1A1A1A` offset. 
- **Active/Pressed State:** When clicked or tapped, the shadow should transition to `2px 2px 0px #1A1A1A` with a corresponding `translate(4px, 4px)` transform. This creates a tactile "plunge" effect.
- **Tonal Layering:** Deep depth is achieved by stacking white surface cards on the cream canvas, each with their own black border and offset shadow.

## Shapes

To maintain the "Brutalist" aspect of the design system, **sharp corners (0px)** are preferred for all primary containers, buttons, and inputs. This emphasizes the rigid, industrial nature of the product. 

- **Exceptions:** Status badges (chips) and the AI Copilot chat bubbles may use a "Soft" (0.25rem) radius to provide a slight visual distinction from structural grid elements.
- **Borders:** A consistent `2px` border is the default, increasing to `4px` for primary brand containers or high-level hero blocks.

## Components

### Buttons
- **Primary:** Orange background, 2px black border, 6px black shadow. Text is uppercase Space Grotesk Bold.
- **Secondary:** White background, 2px black border, 6px black shadow.
- **Destructive:** Red background, 2px black border, 6px black shadow.

### Inputs
- **Default:** White background, 2px black border, no shadow at rest, 4px shadow on focus. Labels sit outside the input box in Bold Inter.
- **Steppers:** Use large + and - buttons for numeric production logs to minimize keyboard usage on mobile.

### Cards (Bento Tiles)
- White background, 2px black border, 6px hard shadow.
- Inner padding should be a minimum of 24px.
- Use JetBrains Mono for all primary metrics inside cards.

### Status Chips
- High-contrast background (Success Green, Danger Red, etc.) with a 2px black border.
- Must include a leading icon for accessibility.

### Progress Bars
- Thick 2px black border container.
- Flat color fill (no gradients). 
- Use the Warning Yellow color once a mould reaches 90% of its shot life.