---
name: create-blazor-component
description: Generate a reusable Blazor component following best practices
---

# Create Blazor Component

Generate a reusable Blazor component with proper parameter handling, event callbacks, and accessibility.

## Context Required

Before generating, check:
1. `.memory-bank/project/context.md` for Blazor hosting model (Server/WebAssembly/Auto)
2. Existing component patterns in the codebase
3. UI framework being used (Bootstrap, MudBlazor, Radzen, etc.)

## Input

```
Component Name: {name, e.g., "DataGrid", "ConfirmDialog", "SearchInput"}
Type: {Display | Input | Layout | Container}
Render Mode: {Static | InteractiveServer | InteractiveWebAssembly | InteractiveAuto}
Generic: {yes | no}
CSS Framework: {Bootstrap | MudBlazor | Tailwind | Custom}
Features: {validation | loading states | accessibility | keyboard navigation}
```

## Generation Process

### 1. Analyze Requirements

Determine:
- What parameters does the component need?
- What events should it emit?
- Does it need to manage internal state?
- Should it be generic?

### 2. Generate Component

#### Standard Component

```razor
@* Components/{ComponentName}.razor *@
@namespace {Namespace}.Components

<div class="@CssClass" @attributes="AdditionalAttributes">
    @if (IsLoading)
    {
        @if (LoadingTemplate is not null)
        {
            @LoadingTemplate
        }
        else
        {
            <div class="spinner-border spinner-border-sm" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        }
    }
    else if (HasError)
    {
        @if (ErrorTemplate is not null)
        {
            @ErrorTemplate(ErrorMessage)
        }
        else
        {
            <div class="alert alert-danger" role="alert">
                @ErrorMessage
            </div>
        }
    }
    else
    {
        @ChildContent
    }
</div>

@code {
    /// <summary>
    /// The content to display inside the component
    /// </summary>
    [Parameter]
    public RenderFragment? ChildContent { get; set; }

    /// <summary>
    /// Template to display while loading
    /// </summary>
    [Parameter]
    public RenderFragment? LoadingTemplate { get; set; }

    /// <summary>
    /// Template to display on error
    /// </summary>
    [Parameter]
    public RenderFragment<string?>? ErrorTemplate { get; set; }

    /// <summary>
    /// Whether the component is in a loading state
    /// </summary>
    [Parameter]
    public bool IsLoading { get; set; }

    /// <summary>
    /// Whether the component has an error
    /// </summary>
    [Parameter]
    public bool HasError { get; set; }

    /// <summary>
    /// Error message to display
    /// </summary>
    [Parameter]
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// Additional CSS classes to apply
    /// </summary>
    [Parameter]
    public string? Class { get; set; }

    /// <summary>
    /// Captures unmatched attributes
    /// </summary>
    [Parameter(CaptureUnmatchedValues = true)]
    public Dictionary<string, object>? AdditionalAttributes { get; set; }

    private string CssClass => $"component-wrapper {Class}".Trim();
}
```

#### Generic List Component

```razor
@* Components/GenericList.razor *@
@namespace {Namespace}.Components
@typeparam TItem

<div class="list-container @Class">
    @if (Items is null)
    {
        @if (LoadingTemplate is not null)
        {
            @LoadingTemplate
        }
        else
        {
            <div class="d-flex justify-content-center p-3">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        }
    }
    else if (!Items.Any())
    {
        @if (EmptyTemplate is not null)
        {
            @EmptyTemplate
        }
        else
        {
            <div class="text-center text-muted p-3">
                @EmptyMessage
            </div>
        }
    }
    else
    {
        <ul class="list-group @ListClass" role="list">
            @foreach (var item in Items)
            {
                <li class="list-group-item @ItemClass"
                    role="listitem"
                    @onclick="() => OnItemClick(item)"
                    @onkeydown="e => HandleKeyDown(e, item)"
                    tabindex="@(Selectable ? 0 : -1)">
                    @ItemTemplate(item)
                </li>
            }
        </ul>
    }
</div>

@code {
    [Parameter, EditorRequired]
    public IEnumerable<TItem>? Items { get; set; }

    [Parameter, EditorRequired]
    public RenderFragment<TItem> ItemTemplate { get; set; } = default!;

    [Parameter]
    public RenderFragment? LoadingTemplate { get; set; }

    [Parameter]
    public RenderFragment? EmptyTemplate { get; set; }

    [Parameter]
    public string EmptyMessage { get; set; } = "No items to display.";

    [Parameter]
    public string? Class { get; set; }

    [Parameter]
    public string? ListClass { get; set; }

    [Parameter]
    public string? ItemClass { get; set; }

    [Parameter]
    public bool Selectable { get; set; }

    [Parameter]
    public EventCallback<TItem> OnItemSelected { get; set; }

    private async Task OnItemClick(TItem item)
    {
        if (Selectable && OnItemSelected.HasDelegate)
        {
            await OnItemSelected.InvokeAsync(item);
        }
    }

    private async Task HandleKeyDown(KeyboardEventArgs e, TItem item)
    {
        if (e.Key == "Enter" || e.Key == " ")
        {
            await OnItemClick(item);
        }
    }
}
```

#### Form Input Component

```razor
@* Components/FormInput.razor *@
@namespace {Namespace}.Components
@inherits InputBase<string>

<div class="mb-3">
    @if (!string.IsNullOrEmpty(Label))
    {
        <label for="@Id" class="form-label">
            @Label
            @if (Required)
            {
                <span class="text-danger" aria-hidden="true">*</span>
            }
        </label>
    }

    <input type="@InputType"
           id="@Id"
           class="@CssClass"
           value="@CurrentValue"
           @oninput="HandleInput"
           @onblur="HandleBlur"
           placeholder="@Placeholder"
           disabled="@Disabled"
           readonly="@ReadOnly"
           required="@Required"
           aria-describedby="@AriaDescribedBy"
           aria-invalid="@(HasValidationErrors ? "true" : null)"
           @attributes="AdditionalAttributes" />

    @if (!string.IsNullOrEmpty(HelpText))
    {
        <div id="@HelpTextId" class="form-text">@HelpText</div>
    }

    @if (HasValidationErrors)
    {
        <div id="@ErrorId" class="invalid-feedback" role="alert">
            @string.Join(", ", ValidationErrors)
        </div>
    }
</div>

@code {
    [Parameter]
    public string? Label { get; set; }

    [Parameter]
    public string? Placeholder { get; set; }

    [Parameter]
    public string? HelpText { get; set; }

    [Parameter]
    public string InputType { get; set; } = "text";

    [Parameter]
    public bool Required { get; set; }

    [Parameter]
    public bool Disabled { get; set; }

    [Parameter]
    public bool ReadOnly { get; set; }

    [Parameter]
    public bool ValidateOnBlur { get; set; } = true;

    [Parameter]
    public EventCallback<string> OnValueChanged { get; set; }

    [Parameter(CaptureUnmatchedValues = true)]
    public Dictionary<string, object>? AdditionalAttributes { get; set; }

    private string Id { get; } = $"input-{Guid.NewGuid():N}";
    private string HelpTextId => $"{Id}-help";
    private string ErrorId => $"{Id}-error";

    private bool HasValidationErrors => EditContext?.GetValidationMessages(FieldIdentifier).Any() ?? false;
    private IEnumerable<string> ValidationErrors => EditContext?.GetValidationMessages(FieldIdentifier) ?? [];

    private string AriaDescribedBy
    {
        get
        {
            var ids = new List<string>();
            if (!string.IsNullOrEmpty(HelpText)) ids.Add(HelpTextId);
            if (HasValidationErrors) ids.Add(ErrorId);
            return string.Join(" ", ids);
        }
    }

    private string CssClass
    {
        get
        {
            var css = "form-control";
            if (HasValidationErrors) css += " is-invalid";
            if (AdditionalAttributes?.TryGetValue("class", out var additionalClass) == true)
            {
                css += $" {additionalClass}";
            }
            return css;
        }
    }

    protected override bool TryParseValueFromString(
        string? value,
        out string result,
        out string validationErrorMessage)
    {
        result = value ?? string.Empty;
        validationErrorMessage = string.Empty;
        return true;
    }

    private async Task HandleInput(ChangeEventArgs e)
    {
        CurrentValueAsString = e.Value?.ToString();

        if (OnValueChanged.HasDelegate)
        {
            await OnValueChanged.InvokeAsync(CurrentValue);
        }
    }

    private void HandleBlur()
    {
        if (ValidateOnBlur)
        {
            EditContext?.NotifyFieldChanged(FieldIdentifier);
        }
    }
}
```

#### Modal Dialog Component

```razor
@* Components/Modal.razor *@
@namespace {Namespace}.Components

@if (IsVisible)
{
    <div class="modal-backdrop fade show" @onclick="HandleBackdropClick"></div>
    <div class="modal fade show d-block"
         tabindex="-1"
         role="dialog"
         aria-modal="true"
         aria-labelledby="@TitleId"
         @onkeydown="HandleKeyDown">
        <div class="modal-dialog @SizeClass @CenteredClass">
            <div class="modal-content">
                @if (!string.IsNullOrEmpty(Title) || HeaderTemplate is not null)
                {
                    <div class="modal-header">
                        @if (HeaderTemplate is not null)
                        {
                            @HeaderTemplate
                        }
                        else
                        {
                            <h5 class="modal-title" id="@TitleId">@Title</h5>
                        }
                        @if (ShowCloseButton)
                        {
                            <button type="button"
                                    class="btn-close"
                                    aria-label="Close"
                                    @onclick="Close">
                            </button>
                        }
                    </div>
                }

                <div class="modal-body">
                    @ChildContent
                </div>

                @if (FooterTemplate is not null)
                {
                    <div class="modal-footer">
                        @FooterTemplate
                    </div>
                }
            </div>
        </div>
    </div>
}

@code {
    [Parameter]
    public bool IsVisible { get; set; }

    [Parameter]
    public EventCallback<bool> IsVisibleChanged { get; set; }

    [Parameter]
    public string? Title { get; set; }

    [Parameter]
    public RenderFragment? HeaderTemplate { get; set; }

    [Parameter]
    public RenderFragment? ChildContent { get; set; }

    [Parameter]
    public RenderFragment? FooterTemplate { get; set; }

    [Parameter]
    public ModalSize Size { get; set; } = ModalSize.Default;

    [Parameter]
    public bool Centered { get; set; }

    [Parameter]
    public bool ShowCloseButton { get; set; } = true;

    [Parameter]
    public bool CloseOnBackdropClick { get; set; } = true;

    [Parameter]
    public bool CloseOnEscape { get; set; } = true;

    [Parameter]
    public EventCallback OnClosed { get; set; }

    private string TitleId { get; } = $"modal-title-{Guid.NewGuid():N}";

    private string SizeClass => Size switch
    {
        ModalSize.Small => "modal-sm",
        ModalSize.Large => "modal-lg",
        ModalSize.ExtraLarge => "modal-xl",
        _ => ""
    };

    private string CenteredClass => Centered ? "modal-dialog-centered" : "";

    private async Task Close()
    {
        IsVisible = false;
        await IsVisibleChanged.InvokeAsync(false);
        await OnClosed.InvokeAsync();
    }

    private async Task HandleBackdropClick()
    {
        if (CloseOnBackdropClick)
        {
            await Close();
        }
    }

    private async Task HandleKeyDown(KeyboardEventArgs e)
    {
        if (e.Key == "Escape" && CloseOnEscape)
        {
            await Close();
        }
    }
}

@code {
    public enum ModalSize { Small, Default, Large, ExtraLarge }
}
```

### 3. Create CSS Isolation (Optional)

```css
/* Components/{ComponentName}.razor.css */
.component-wrapper {
    /* Component-specific styles */
}
```

## Output Checklist

- [ ] Component parameters documented with XML comments
- [ ] EventCallback for output communication
- [ ] RenderFragment for content projection
- [ ] Accessibility attributes (aria-*, role)
- [ ] Keyboard navigation support
- [ ] Loading and error states
- [ ] CSS isolation or proper class handling
- [ ] Generic type support if needed
- [ ] CaptureUnmatchedValues for flexibility

## Memory Bank Updates

Document in `.memory-bank/modules/{module}/context.md`:
- Component API (parameters, events)
- Usage examples
- Accessibility features
