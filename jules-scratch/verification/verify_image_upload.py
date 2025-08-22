import re
from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Go to the app
    page.goto("http://127.0.0.1:8080/")

    # Log in
    page.get_by_label("Email").fill("test@test.com")
    page.get_by_label("Password").fill("password")
    page.get_by_role("button", name="Sign In").click()

    # Wait for navigation after login
    expect(page.get_by_role("link", name="Users")).to_be_visible()

    # Go to users page
    page.get_by_role("link", name="Users").click()

    # Find a user and click the message button
    expect(page.get_by_role("button", name="Chat")).to_be_visible()
    page.get_by_role("button", name="Chat").first.click()

    # Now we are in the chat window.
    # Upload image
    page.locator('input[type="file"]').set_input_files("jules-scratch/verification/red.png")

    # Add caption
    page.get_by_placeholder("Add a caption...").fill("Here is an image!")

    # Send message
    page.get_by_role("button", name="Send message").click()

    # Wait for the message to appear.
    expect(page.get_by_text("Here is an image!")).to_be_visible()

    # Take a screenshot of the whole page.
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
