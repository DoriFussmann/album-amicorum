# Album Amicorum Website Implementation Guide

Version 1.0

---

## Purpose

This document defines how the Website Specification should be implemented.

The Website Specification v1.0.md is the single source of truth.

This document defines implementation behavior only.

If these documents ever conflict:

Website Specification v1.0.md wins.

---

# Project Goal

Implement the Website Specification faithfully.

Do not redesign the website.

Do not reinterpret the specification.

Do not "improve" approved copy.

Implement it exactly.

---

# Scope

This project is a content implementation project.

It is NOT a software engineering project.

Engineering changes should be avoided unless absolutely required to support the specified experience.

---

# Never Change

Do NOT modify:

• routing

• URLs

• slugs

• metadata

• title tags

• meta descriptions

• OpenGraph

• Twitter Cards

• canonical URLs

• robots

• sitemap

• schema.org

• structured data

• analytics

• Stripe integration

• checkout functionality

• business logic

• authentication

• forms (except visible labels/placeholders)

• APIs

• database

• image optimization

• lazy loading

• accessibility implementation

• responsive implementation

• performance optimizations

• build configuration

• dependencies

• deployment

Assume these are already correct.

---

# Allowed Changes

Visible copy

Section ordering

Headings

Paragraphs

Buttons

CTAs

Product descriptions

Image placeholders

Image placeholder prompts

Testimonials

Form labels

Placeholder text

Footer wording

FAQ wording

Navigation labels

Microcopy

Whitespace adjustments

Presentation improvements that do not affect functionality

---

# Workflow

Always work page-by-page.

Never make unrelated edits.

Never refactor while implementing content.

Complete one page before moving to another.

---

# Images

No final photography should be added.

Where images are missing:

Create the placeholder exactly as defined in the Website Specification.

Never invent placeholder wording.

---

# Copy

Do not rewrite approved copy.

Do not shorten.

Do not improve.

Do not paraphrase.

Use the specification verbatim wherever possible.

---

# Components

Reuse existing components whenever possible.

Avoid creating new components unless the existing implementation cannot support the specification.

---

# Existing Functionality

Preserve all existing functionality.

The implementation should improve storytelling—not engineering.

---

# When Conflicts Exist

If the existing implementation cannot satisfy the Website Specification without affecting engineering:

Stop.

Explain the conflict.

Wait for approval.

Never guess.

---

# Definition of Done

The implementation is complete when:

• Every page matches the Website Specification.

• Every heading matches.

• Every paragraph matches.

• Every CTA matches.

• Every placeholder matches.

• Every image placeholder exists.

• Navigation matches.

• Footer matches.

• Microcopy matches.

• Engineering remains unchanged.
