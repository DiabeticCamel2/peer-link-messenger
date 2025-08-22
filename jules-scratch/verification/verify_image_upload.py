import re
from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Go to the app
    page.goto("http://127.0.0.1:8080/")

    # Log in
    page.get_by_label("Email").fill("test2@test.com")
    page.get_by_label("Password").fill("password")
    page.get_by_role("button", name="Login").click()

    # Go to users page
    page.get_by_role("link", name="Users").click()

    # Find a user and click the message button
    page.get_by_role("button", name="Message").first.click()

    # Upload image
    page.get_by_role("button", name="Image").set_input_files("jules-scratch/verification/red.png")

    # Add caption
    page.get_by_placeholder("Add a caption...").fill("Here is an image!")

    # Send message
    page.get_by_role("button", name="Send message").click()

    # Wait for the message to appear
    expect(page.get_by_text("Here is an image!")).to_be_visible()

    # Take screenshot
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
